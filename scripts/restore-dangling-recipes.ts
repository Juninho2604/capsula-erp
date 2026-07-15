/**
 * restore-dangling-recipes.ts (§117.1) — Revive recetas soft-borradas que
 * siguen vinculadas a platos ACTIVOS del menú.
 *
 * Contexto: Christian reporta que "la gran mayoría de platos del menú" no
 * aparecen para vincular/crear receta. Causa probable: un soft-delete masivo
 * de recetas (isActive=false + deletedAt) dejó los MenuItem.recipeId colgando.
 * Las recetas soft-borradas CONSERVAN sus ingredientes — revivirlas recupera
 * todo el trabajo, en vez de recrear stubs vacíos uno por uno.
 *
 * Qué hace con --apply (por defecto DRY-RUN, no escribe nada):
 *   Para cada MenuItem activo cuyo recipeId apunta a una receta INACTIVA:
 *     → recipe.isActive = true, deletedAt = null
 *   No toca: platos inactivos, recetas sin vínculo, recetas ya activas,
 *   ni MenuItem.recipeId (el vínculo ya existe, solo estaba muerto).
 *
 * Uso:
 *   npx tsx scripts/restore-dangling-recipes.ts --tenant-slug=shanklish
 *   npx tsx scripts/restore-dangling-recipes.ts --tenant-slug=shanklish --apply
 */

import { PrismaClient } from '@prisma/client';

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }
    const slug = args['tenant-slug'] || 'shanklish';
    const apply = args['apply'] === 'true';

    const prisma = new PrismaClient();
    try {
        const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
        if (!tenant) { console.error(`Tenant "${slug}" no existe`); process.exit(2); }

        console.log(`\n═══ REVIVIR RECETAS COLGANTES · ${tenant.name} ═══ (${apply ? 'APLICAR' : 'DRY-RUN'})\n`);

        const items = await prisma.menuItem.findMany({
            where: { tenantId: tenant.id, isActive: true, recipeId: { not: null } },
            select: { id: true, name: true, recipeId: true, category: { select: { name: true } } },
            orderBy: { name: 'asc' },
        });

        const recipeIds = [...new Set(items.map(i => i.recipeId!))];
        const recipes = await prisma.recipe.findMany({
            where: { id: { in: recipeIds } },
            select: {
                id: true, name: true, isActive: true, deletedAt: true,
                _count: { select: { ingredients: true } },
            },
        });
        const byId = new Map(recipes.map(r => [r.id, r]));

        const toRestore: { itemName: string; catName: string; recipe: (typeof recipes)[number] }[] = [];
        const orphan: typeof items = []; // recipeId apunta a receta que NO existe (hard-deleted)

        for (const it of items) {
            const r = byId.get(it.recipeId!);
            if (!r) { orphan.push(it); continue; }
            if (!r.isActive) toRestore.push({ itemName: it.name, catName: it.category?.name ?? 'sin cat', recipe: r });
        }

        console.log(`Platos activos con vínculo a receta: ${items.length}`);
        console.log(`  🟢 con receta viva:              ${items.length - toRestore.length - orphan.length}`);
        console.log(`  🔴 con receta soft-borrada:      ${toRestore.length}  ← se revivirán`);
        console.log(`  ⚫ con receta INEXISTENTE (hard): ${orphan.length}  ← usar el panel "sin receta" (§117)\n`);

        if (toRestore.length) {
            console.log('Recetas a revivir (con sus ingredientes intactos):');
            for (const t of toRestore) {
                console.log(`  · "${t.recipe.name}" (${t.recipe._count.ingredients} ingredientes) ← plato "${t.itemName}" [${t.catName}]`);
            }
            console.log('');
        }
        if (orphan.length) {
            console.log('Platos cuyo recipeId no existe (no hay nada que revivir — crear receta desde el panel):');
            for (const it of orphan) console.log(`  · ${it.name} [${it.category?.name ?? 'sin cat'}]`);
            console.log('');
        }

        if (!toRestore.length) { console.log('Nada que revivir.'); return; }
        if (!apply) { console.log('DRY-RUN: no se escribió nada. Repetí con --apply para revivirlas.'); return; }

        const ids = [...new Set(toRestore.map(t => t.recipe.id))];
        const res = await prisma.recipe.updateMany({
            where: { id: { in: ids }, tenantId: tenant.id },
            data: { isActive: true, deletedAt: null },
        });
        console.log(`✅ ${res.count} recetas revividas. Los platos vuelven a descontar inventario y las recetas reaparecen en /dashboard/recetas.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
