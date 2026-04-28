/**
 * AUDIT — POS Deduction Failures (read-only)
 * ───────────────────────────────────────────────────────────────────────────
 * Identifica ventas del POS donde registerInventoryForCartItems falló y
 * dejó el marcador "[DESCARGO INVENTARIO PENDIENTE — Revisar manualmente]"
 * en SalesOrder.notes.
 *
 * A diferencia del banner gerencial (que solo cuenta), este script
 * profundiza:
 *   - Distribución por canal (POS_RESTAURANT / POS_DELIVERY / POS_MESERO)
 *   - Distribución por día (heatmap de ocurrencias)
 *   - MenuItems más frecuentemente involucrados (probable causa)
 *   - Items que NO tienen receta vinculada (root-cause estructural)
 *
 * Solo lectura — no modifica BD.
 *
 * Uso:
 *   npx tsx scripts/audit-deduction-failures.ts                  # 30 días
 *   npx tsx scripts/audit-deduction-failures.ts --days 90        # 90 días
 *   npx tsx scripts/audit-deduction-failures.ts --csv > out.csv  # CSV
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(flag: string, fallback: string | number): string {
    const idx = process.argv.indexOf(flag);
    if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
    return String(fallback);
}

const DAYS = parseInt(arg('--days', 30), 10);
const CSV_FLAG = process.argv.includes('--csv');

async function main() {
    const since = new Date();
    since.setDate(since.getDate() - DAYS);

    const where = {
        createdAt: { gte: since },
        notes: { contains: 'DESCARGO INVENTARIO PENDIENTE' },
    };

    const failedOrders = await prisma.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            items: {
                select: {
                    menuItemId: true,
                    productName: true,
                    quantity: true,
                },
            },
        },
    });

    if (CSV_FLAG) {
        console.log('orderNumber,createdAt,sourceChannel,total,itemCount,notes');
        for (const o of failedOrders) {
            const cells = [
                o.orderNumber,
                o.createdAt.toISOString(),
                o.sourceChannel,
                String(Number(o.total)),
                String(o.items.length),
                (o.notes ?? '').replace(/"/g, '""').replace(/\n/g, ' '),
            ].map(c => `"${c}"`);
            console.log(cells.join(','));
        }
        process.exit(0);
    }

    console.log(`\n=== AUDIT: POS Deduction Failures (read-only) ===`);
    console.log(`Ventana: últimos ${DAYS} días (desde ${since.toISOString().slice(0, 10)})`);
    console.log(`Total ventas con descargo pendiente: ${failedOrders.length}\n`);

    if (failedOrders.length === 0) {
        console.log('Sin hallazgos. El descargo de inventario funciona correctamente.');
        return;
    }

    // 1) Por canal
    const byChannel: Record<string, number> = {};
    for (const o of failedOrders) {
        byChannel[o.sourceChannel] = (byChannel[o.sourceChannel] ?? 0) + 1;
    }
    console.log('--- Por canal de origen ---');
    console.table(
        Object.entries(byChannel)
            .sort((a, b) => b[1] - a[1])
            .map(([channel, count]) => ({ channel, count, pct: `${((count / failedOrders.length) * 100).toFixed(1)}%` })),
    );

    // 2) Por día (heatmap)
    const byDay: Record<string, number> = {};
    for (const o of failedOrders) {
        const day = o.createdAt.toISOString().slice(0, 10);
        byDay[day] = (byDay[day] ?? 0) + 1;
    }
    console.log('\n--- Por día (top 10 con más fallos) ---');
    console.table(
        Object.entries(byDay)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([day, count]) => ({ day, count })),
    );

    // 3) MenuItems más frecuentes en ventas con fallo
    const byItem: Record<string, { name: string; count: number; menuItemId: string }> = {};
    for (const o of failedOrders) {
        for (const li of o.items) {
            if (!li.menuItemId) continue;
            const k = li.menuItemId;
            if (!byItem[k]) byItem[k] = { name: li.productName, count: 0, menuItemId: k };
            byItem[k].count += Number(li.quantity);
        }
    }
    const topItems = Object.values(byItem).sort((a, b) => b.count - a.count).slice(0, 15);
    console.log('\n--- MenuItems más frecuentes en fallos (top 15) ---');
    console.table(topItems.map(i => ({ menuItem: i.name, qtyTotal: i.count })));

    // 4) Cuáles de esos items NO tienen receta vinculada (root-cause)
    const topItemIds = topItems.map(i => i.menuItemId);
    if (topItemIds.length > 0) {
        const itemDetails = await prisma.menuItem.findMany({
            where: { id: { in: topItemIds } },
            select: { id: true, name: true, sku: true, recipeId: true },
        });

        const validRecipeIds = (
            await prisma.recipe.findMany({
                where: {
                    id: { in: itemDetails.map(i => i.recipeId).filter((x): x is string => !!x) },
                    isActive: true,
                },
                select: { id: true },
            })
        ).map(r => r.id);

        const noRecipe = itemDetails.filter(i => !i.recipeId);
        const ghostRecipe = itemDetails.filter(i => i.recipeId && !validRecipeIds.includes(i.recipeId));

        if (noRecipe.length > 0) {
            console.log('\n--- Items SIN receta vinculada (causa estructural) ---');
            console.table(noRecipe.map(i => ({ sku: i.sku, name: i.name })));
        }
        if (ghostRecipe.length > 0) {
            console.log('\n--- Items con receta inexistente / inactiva ---');
            console.table(ghostRecipe.map(i => ({ sku: i.sku, name: i.name, recipeId: i.recipeId })));
        }
        if (noRecipe.length === 0 && ghostRecipe.length === 0) {
            console.log('\nLos items frecuentes tienen recetas válidas; los fallos pueden ser por stock insuficiente o errores transitorios. Revisa logs del POS.');
        }
    }

    console.log(`\nSugerencia: añadir --csv para exportar las ${failedOrders.length} órdenes a archivo.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
