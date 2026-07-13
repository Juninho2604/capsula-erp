/**
 * audit-recetas-tipos.ts (§114) — Detecta recetas MAL TIPADAS que no aparecen
 * como ingrediente al armar otra receta. SOLO LECTURA.
 *
 * El picker de ingredientes toma insumos (RAW_MATERIAL) y sub-recetas
 * (SUB_RECIPE), NUNCA productos de venta (FINISHED_GOOD). Si un componente
 * (ej. "Sofrito de Kibbe") se guardó como Producto Final, no aparece.
 *
 * Este script lista:
 *   (A) Recetas tipo FINISHED_GOOD cuyo output SÍ se usa como ingrediente en
 *       otra receta → casi seguro deberían ser SUB_RECIPE (arreglar el tipo).
 *   (B) Sub-recetas cuyo output item está INACTIVO → no salen en el picker.
 *   (C) Conteo general por tipo.
 *
 * Uso:
 *   npx tsx scripts/audit-recetas-tipos.ts --tenant-slug=shanklish
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
    if (!slug) { console.error('Uso: --tenant-slug=shanklish'); process.exit(2); }

    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tenant) { console.error('Tenant no existe'); process.exit(2); }

    console.log(`\n═══ AUDITORÍA TIPOS DE RECETA · ${tenant.name} ═══ (solo lectura)\n`);

    const recipes = await prisma.recipe.findMany({
        where: { tenantId: tenant.id },
        include: { outputItem: { select: { id: true, name: true, type: true, isActive: true } } },
    });

    // Conteo por tipo.
    const byType: Record<string, number> = {};
    for (const r of recipes) byType[r.outputItem.type] = (byType[r.outputItem.type] ?? 0) + 1;
    console.log('Recetas por tipo:');
    for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`);
    console.log('');

    // (A) FINISHED_GOOD usados como ingrediente en otra receta.
    const outputItemIds = recipes.map(r => r.outputItem.id);
    const usedAsIngredient = await prisma.recipeIngredient.findMany({
        where: { ingredientItemId: { in: outputItemIds } },
        select: { ingredientItemId: true, recipe: { select: { name: true } } },
    });
    const usedMap = new Map<string, string[]>();
    for (const ri of usedAsIngredient) {
        const arr = usedMap.get(ri.ingredientItemId) ?? [];
        arr.push(ri.recipe.name);
        usedMap.set(ri.ingredientItemId, arr);
    }

    const misTyped = recipes.filter(r => r.outputItem.type === 'FINISHED_GOOD' && usedMap.has(r.outputItem.id));
    console.log(`(A) Productos de venta usados como ingrediente (¿deberían ser Sub-receta?): ${misTyped.length}`);
    for (const r of misTyped) {
        console.log(`  ⚠ "${r.outputItem.name}" es FINISHED_GOOD pero lo usan: ${usedMap.get(r.outputItem.id)!.join(', ')}`);
        console.log(`     → Abrir la receta y cambiar el tipo a "Sub-receta (Intermedio)".`);
    }
    if (misTyped.length === 0) console.log('  ✓ Ninguno.');
    console.log('');

    // (B) Sub-recetas inactivas.
    const inactiveSub = recipes.filter(r => r.outputItem.type === 'SUB_RECIPE' && !r.outputItem.isActive);
    console.log(`(B) Sub-recetas con output INACTIVO (no salen en el picker): ${inactiveSub.length}`);
    for (const r of inactiveSub) console.log(`  ⚠ "${r.outputItem.name}"`);
    if (inactiveSub.length === 0) console.log('  ✓ Ninguna.');
    console.log('');

    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
