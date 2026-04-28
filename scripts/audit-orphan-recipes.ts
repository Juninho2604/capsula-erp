/**
 * AUDIT — Orphan Recipes (read-only)
 * ───────────────────────────────────────────────────────────────────────────
 * Detecta MenuItems con recipeId que apuntan a:
 *   1. Recetas inexistentes (FK rota — recipeId nunca tuvo @relation real)
 *   2. Recetas con isActive = false (soft-deleted o desactivadas)
 *
 * También detecta:
 *   3. Recetas activas SIN ningún MenuItem que las referencie (huérfanas
 *      al revés — desperdicio de mantenimiento).
 *
 * Solo lectura. NO modifica BD. Output: tabla por consola + CSV opcional.
 *
 * Uso:
 *   npx tsx scripts/audit-orphan-recipes.ts
 *   npx tsx scripts/audit-orphan-recipes.ts --csv > orphan-recipes.csv
 *
 * Útil como gate previo a la migración de Fase 2 que añade @relation
 * MenuItem.recipe → Recipe (que fallaría si hay huérfanos vivos).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CSV_FLAG = process.argv.includes('--csv');

interface OrphanRow {
    type: 'MENU_ITEM_TO_GHOST_RECIPE' | 'MENU_ITEM_TO_INACTIVE_RECIPE' | 'RECIPE_WITHOUT_MENU_ITEM';
    menuItemId?: string;
    menuItemName?: string;
    menuItemSku?: string;
    recipeId?: string;
    recipeName?: string;
    detail: string;
}

async function main() {
    const rows: OrphanRow[] = [];

    // 1) MenuItems con recipeId que no resuelve a una receta existente
    //    (recipeId es String sin FK declarada, así que necesitamos query manual)
    const menuItemsWithRecipe = await prisma.menuItem.findMany({
        where: {
            recipeId: { not: null },
            isActive: true,
        },
        select: { id: true, name: true, sku: true, recipeId: true },
    });

    const referencedRecipeIds = Array.from(
        new Set(menuItemsWithRecipe.map(m => m.recipeId).filter((id): id is string => !!id)),
    );

    const existingRecipes = await prisma.recipe.findMany({
        where: { id: { in: referencedRecipeIds } },
        select: { id: true, name: true, isActive: true },
    });
    const recipeMap = new Map(existingRecipes.map(r => [r.id, r] as const));

    for (const mi of menuItemsWithRecipe) {
        if (!mi.recipeId) continue;
        const recipe = recipeMap.get(mi.recipeId);
        if (!recipe) {
            rows.push({
                type: 'MENU_ITEM_TO_GHOST_RECIPE',
                menuItemId: mi.id,
                menuItemName: mi.name,
                menuItemSku: mi.sku,
                recipeId: mi.recipeId,
                detail: 'recipeId apunta a una receta inexistente',
            });
        } else if (!recipe.isActive) {
            rows.push({
                type: 'MENU_ITEM_TO_INACTIVE_RECIPE',
                menuItemId: mi.id,
                menuItemName: mi.name,
                menuItemSku: mi.sku,
                recipeId: mi.recipeId,
                recipeName: recipe.name,
                detail: 'recipeId apunta a una receta con isActive=false',
            });
        }
    }

    // 2) Recetas activas sin MenuItem referenciador
    const activeRecipes = await prisma.recipe.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });
    const referencedSet = new Set(referencedRecipeIds);
    for (const r of activeRecipes) {
        if (!referencedSet.has(r.id)) {
            rows.push({
                type: 'RECIPE_WITHOUT_MENU_ITEM',
                recipeId: r.id,
                recipeName: r.name,
                detail: 'receta activa sin ningún MenuItem.recipeId que la apunte',
            });
        }
    }

    // ── Output ────────────────────────────────────────────────────────────
    const ghosts = rows.filter(r => r.type === 'MENU_ITEM_TO_GHOST_RECIPE');
    const inactive = rows.filter(r => r.type === 'MENU_ITEM_TO_INACTIVE_RECIPE');
    const orphanRecipes = rows.filter(r => r.type === 'RECIPE_WITHOUT_MENU_ITEM');

    if (CSV_FLAG) {
        // CSV plano (un solo header, todas las filas)
        const headers = ['type', 'menuItemId', 'menuItemName', 'menuItemSku', 'recipeId', 'recipeName', 'detail'];
        console.log(headers.join(','));
        for (const r of rows) {
            const values = headers.map(h => {
                const v = (r as any)[h] ?? '';
                return `"${String(v).replace(/"/g, '""')}"`;
            });
            console.log(values.join(','));
        }
        process.exit(0);
    }

    console.log('\n=== AUDIT: Orphan Recipes (read-only) ===\n');

    console.log(`MenuItems → receta inexistente:           ${ghosts.length}`);
    console.log(`MenuItems → receta inactiva:              ${inactive.length}`);
    console.log(`Recetas activas sin MenuItem que las use: ${orphanRecipes.length}`);
    console.log('');

    if (ghosts.length > 0) {
        console.log('--- MenuItems con recipeId roto (FK fantasma) ---');
        console.table(ghosts.map(r => ({
            menuItemSku: r.menuItemSku, menuItemName: r.menuItemName, recipeId: r.recipeId,
        })));
    }

    if (inactive.length > 0) {
        console.log('--- MenuItems vinculados a recetas archivadas/inactivas ---');
        console.table(inactive.map(r => ({
            menuItemSku: r.menuItemSku, menuItemName: r.menuItemName,
            recipeId: r.recipeId, recipeName: r.recipeName,
        })));
    }

    if (orphanRecipes.length > 0) {
        console.log('--- Recetas activas no usadas por ningún MenuItem ---');
        console.table(orphanRecipes.map(r => ({
            recipeId: r.recipeId, recipeName: r.recipeName,
        })));
    }

    if (rows.length === 0) {
        console.log('Sin hallazgos. Las relaciones MenuItem ↔ Recipe están sanas.');
    } else {
        console.log(`\nTotal hallazgos: ${rows.length}`);
        console.log('Sugerencia: añadir --csv para exportar a archivo.');
    }
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
