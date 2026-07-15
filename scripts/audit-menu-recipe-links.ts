/**
 * audit-menu-recipe-links.ts — Diagnóstico de platos del menú "invisibles" en
 * Recetas. SOLO LECTURA.
 *
 * Un plato queda invisible cuando su MenuItem.recipeId apunta a una receta
 * MUERTA (borrada/inactiva): no sale en "platos sin receta" (recipeId != null)
 * ni en la lista de recetas (isActive=false). El fix de menu.actions ya los
 * vuelve a mostrar; este script sirve para CONFIRMAR el estado de un plato
 * puntual (ej. "shawarma de carne") y ver todos los afectados.
 *
 * Uso:
 *   # Todos los links colgantes del tenant:
 *   npx tsx scripts/audit-menu-recipe-links.ts --tenant-slug=shanklish
 *
 *   # Buscar un plato por nombre (activo o inactivo), ver por qué no aparece:
 *   npx tsx scripts/audit-menu-recipe-links.ts --tenant-slug=shanklish --buscar="shawarma"
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
    const buscar = (args['buscar'] || '').trim();

    const prisma = new PrismaClient();
    try {
        const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
        if (!tenant) { console.error(`Tenant "${slug}" no existe`); process.exit(2); }

        console.log(`\n═══ AUDITORÍA LINKS MENÚ↔RECETA · ${tenant.name} ═══ (solo lectura)\n`);

        const liveRecipes = await prisma.recipe.findMany({
            where: { tenantId: tenant.id, isActive: true },
            select: { id: true },
        });
        const liveIds = new Set(liveRecipes.map(r => r.id));

        // ── Búsqueda puntual por nombre ──────────────────────────────────────
        if (buscar) {
            const hits = await prisma.menuItem.findMany({
                where: { tenantId: tenant.id, name: { contains: buscar, mode: 'insensitive' } },
                include: { category: { select: { name: true } } },
                orderBy: { name: 'asc' },
            });
            console.log(`Platos del menú que contienen "${buscar}": ${hits.length}\n`);
            for (const it of hits) {
                let estado: string;
                if (!it.isActive) estado = '⛔ INACTIVO (no sale en Recetas: reactivar en Menú)';
                else if (!it.recipeId) estado = '🟡 SIN RECETA → aparece en el panel "sin receta" (crear ahí)';
                else if (!liveIds.has(it.recipeId)) estado = '🔴 RECETA COLGANTE (muerta) → con el fix vuelve a salir en el panel';
                else estado = '🟢 CON RECETA VIVA (buscala en la lista de Recetas)';
                console.log(`  · ${it.name}  [${it.category?.name ?? 'sin cat'}]`);
                console.log(`      activo=${it.isActive}  recipeId=${it.recipeId ?? 'null'}  → ${estado}`);
            }
            console.log('');

            // ¿Existe como sub-receta / insumo (InventoryItem) en vez de plato?
            const invHits = await prisma.inventoryItem.findMany({
                where: { tenantId: tenant.id, name: { contains: buscar, mode: 'insensitive' } },
                select: { name: true, type: true, isActive: true },
                orderBy: { name: 'asc' },
            });
            if (invHits.length) {
                console.log(`También existe en Inventario (insumo/sub-receta/producto) como:`);
                for (const iv of invHits) console.log(`  · ${iv.name}  type=${iv.type}  activo=${iv.isActive}`);
                console.log('');
            }
        }

        // ── Todos los links colgantes del tenant ─────────────────────────────
        const active = await prisma.menuItem.findMany({
            where: { tenantId: tenant.id, isActive: true },
            include: { category: { select: { name: true } } },
            orderBy: [{ name: 'asc' }],
        });
        const dangling = active.filter(it => it.recipeId && !liveIds.has(it.recipeId));
        const noRecipe = active.filter(it => !it.recipeId);

        console.log(`Platos activos: ${active.length}`);
        console.log(`  🟡 sin receta (recipeId null): ${noRecipe.length}`);
        console.log(`  🔴 con receta COLGANTE (recipeId → receta muerta): ${dangling.length}`);
        if (dangling.length) {
            console.log('\n  Platos con receta colgante (quedaban invisibles antes del fix):');
            for (const it of dangling) console.log(`    · ${it.name}  [${it.category?.name ?? 'sin cat'}]  recipeId=${it.recipeId}`);
        }
        console.log('\nCon el fix aplicado, los 🟡 y 🔴 aparecen en el panel "Platos del Menú sin Receta".');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
