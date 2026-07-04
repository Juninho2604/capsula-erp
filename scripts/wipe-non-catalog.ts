/**
 * WIPE DE TODO LO QUE NO ES CATÁLOGO — recetas, sub-recetas e insumos.
 * El catálogo del POS (MenuItem, MenuCategory, modificadores, precios,
 * mesas/zonas) NO se toca: el mesonero ve y opera exactamente igual.
 *
 * Pedido de Omar/gerente Shanklish (2026-07-04): "borrar todo lo que no sea
 * catálogo" para recargar limpio desde la plantilla Excel.
 *
 * Qué hace:
 *   1. RECETAS (todas, incluidas sub-recetas): soft-delete
 *      (deletedAt + isActive=false). Reversible. Los MenuItem conservan su
 *      recipeId apuntando a la receta muerta → el POS vende igual, sin
 *      descargo, hasta recargar + re-vincular.
 *   2. INVENTORY ITEMS (todos los tipos):
 *      - Sin NINGUNA referencia (ni historial, ni recetas, ni conteos, ni
 *        compras): HARD DELETE real (antes borra sus InventoryLocation y
 *        CostHistory; AreaCriticalItem y SupplierItemPriceHistory caen por
 *        cascade).
 *      - Con referencias: DESACTIVA (isActive=false) — la BD no permite
 *        borrarlos sin destruir historial. Desaparecen de todas las listas.
 *   3. Reporte final: catálogo POS intacto (conteo de MenuItems/categorías).
 *
 * DESPUÉS de este wipe el flujo es:
 *   a. Cargar la plantilla:  import-recetas-xlsx.ts <archivo> --apply --create-missing
 *   b. RE-VINCULAR los platos del menú a las recetas nuevas — obligatorio,
 *      porque los recipeId viejos apuntan a recetas soft-borradas:
 *      llenar la hoja MENU_ITEMS de la plantilla (recomendado) o correr
 *      scripts/relink-menu-recipes.ts --apply (match por nombre).
 *
 * Uso (en el VPS, desde /var/www/capsula-erp, BACKUP PRIMERO):
 *   SEED_TENANT_SLUG=shanklish npx tsx scripts/wipe-non-catalog.ts                 # ENSAYO
 *   SEED_TENANT_SLUG=shanklish npx tsx scripts/wipe-non-catalog.ts --apply
 *   ... --apply --confirm=BORRAR-TODO-SHANKLISH   # doble confirmación obligatoria
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const CONFIRM = process.argv.find(a => a.startsWith('--confirm='))?.split('=')[1];

async function countItemRefs(prisma: PrismaClient, itemId: string): Promise<number> {
    const [
        movements, recipeIng, recipeOut, daily, weekly, auditLines, cycleSnaps,
        reqLines, loans, supplierItems, poLines, protSource, protOut, tplSource, tplOut,
        prodOrders, supplierDocLines, intercompanyLines,
    ] = await Promise.all([
        prisma.inventoryMovement.count({ where: { inventoryItemId: itemId } }),
        prisma.recipeIngredient.count({ where: { ingredientItemId: itemId } }),
        prisma.recipe.count({ where: { outputItemId: itemId } }),
        prisma.dailyInventoryItem.count({ where: { inventoryItemId: itemId } }),
        prisma.weeklyCountItem.count({ where: { inventoryItemId: itemId } }),
        prisma.inventoryAuditItem.count({ where: { inventoryItemId: itemId } }),
        prisma.inventoryCycleSnapshot.count({ where: { inventoryItemId: itemId } }),
        prisma.requisitionItem.count({ where: { inventoryItemId: itemId } }),
        prisma.inventoryLoan.count({ where: { inventoryItemId: itemId } }),
        prisma.supplierItem.count({ where: { inventoryItemId: itemId } }),
        prisma.purchaseOrderItem.count({ where: { inventoryItemId: itemId } }),
        prisma.proteinProcessing.count({ where: { sourceItemId: itemId } }),
        prisma.proteinSubProduct.count({ where: { outputItemId: itemId } }),
        prisma.processingTemplate.count({ where: { sourceItemId: itemId } }),
        prisma.processingTemplateOutput.count({ where: { outputItemId: itemId } }),
        prisma.productionOrder.count({ where: { outputItemId: itemId } }),
        prisma.supplierDocumentItem.count({ where: { inventoryItemId: itemId } }),
        prisma.intercompanySettlementLine.count({ where: { inventoryItemId: itemId } }),
    ]);
    return movements + recipeIng + recipeOut + daily + weekly + auditLines + cycleSnaps
        + reqLines + loans + supplierItems + poLines + protSource + protOut + tplSource + tplOut
        + prodOrders + supplierDocLines + intercompanyLines;
}

async function main() {
    const prisma = new PrismaClient();
    try {
        const slug = process.env.SEED_TENANT_SLUG;
        const tenant = slug
            ? await prisma.tenant.findUnique({ where: { slug } })
            : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!tenant) throw new Error('Tenant no encontrado');

        const expectedConfirm = `BORRAR-TODO-${tenant.slug.toUpperCase()}`;
        console.log(`${APPLY ? '🔥 APLICANDO WIPE' : '🧪 ENSAYO (sin escribir)'} — tenant: ${tenant.name} (${tenant.slug})\n`);

        if (APPLY && CONFIRM !== expectedConfirm) {
            console.log(`⛔ Falta la doble confirmación. Para ejecutar de verdad agregá:`);
            console.log(`   --confirm=${expectedConfirm}`);
            return;
        }

        // ── 1. Recetas: soft-delete masivo ──────────────────────────────────
        const liveRecipes = await prisma.recipe.count({ where: { tenantId: tenant.id, deletedAt: null } });
        console.log(`══ 1. Recetas (incluye sub-recetas): ${liveRecipes} vivas → soft-delete`);
        if (APPLY && liveRecipes > 0) {
            await prisma.recipe.updateMany({
                where: { tenantId: tenant.id, deletedAt: null },
                data: { deletedAt: new Date(), isActive: false },
            });
            console.log('   ✔ soft-borradas (reversible)');
        }

        // ── 2. Inventory items ───────────────────────────────────────────────
        const items = await prisma.inventoryItem.findMany({
            where: { tenantId: tenant.id },
            select: { id: true, sku: true, name: true, type: true, isActive: true },
            orderBy: { name: 'asc' },
        });
        console.log(`\n══ 2. Items de inventario: ${items.length} en total (activos: ${items.filter(i => i.isActive).length})`);

        let hardDeleted = 0, deactivated = 0, alreadyInactive = 0;
        for (const item of items) {
            const refs = await countItemRefs(prisma, item.id);
            if (refs === 0) {
                console.log(`   🗑️  BORRAR: ${item.sku} · ${item.name} (${item.type}) — sin referencias`);
                if (APPLY) {
                    await prisma.$transaction([
                        prisma.inventoryLocation.deleteMany({ where: { inventoryItemId: item.id } }),
                        prisma.costHistory.deleteMany({ where: { inventoryItemId: item.id } }),
                        prisma.inventoryItem.delete({ where: { id: item.id } }),
                    ]);
                }
                hardDeleted++;
            } else if (item.isActive) {
                console.log(`   💤 DESACTIVAR: ${item.sku} · ${item.name} (${item.type}) — ${refs} referencia(s) de historial`);
                if (APPLY) {
                    await prisma.inventoryItem.update({
                        where: { id: item.id },
                        data: { isActive: false },
                    });
                }
                deactivated++;
            } else {
                alreadyInactive++;
            }
        }

        // ── 3. Verificación de catálogo POS (debe quedar intacto) ───────────
        const [menuItems, menuCategories, modifierGroups] = await Promise.all([
            prisma.menuItem.count({ where: { tenantId: tenant.id, isActive: true, deletedAt: null } }),
            prisma.menuCategory.count({ where: { tenantId: tenant.id, isActive: true, deletedAt: null } }),
            prisma.menuModifierGroup.count({ where: { tenantId: tenant.id, isActive: true } }),
        ]);

        console.log('\n──────────────────────────────────────────────');
        console.log(`Recetas soft-borradas:       ${liveRecipes}`);
        console.log(`Items borrados en firme:     ${hardDeleted}`);
        console.log(`Items desactivados:          ${deactivated}`);
        console.log(`Items ya inactivos (quedan): ${alreadyInactive}`);
        console.log(`\nCatálogo POS (INTACTO): ${menuItems} platos · ${menuCategories} categorías · ${modifierGroups} grupos de modificadores`);
        console.log('\n⚠ Desde este momento el POS vende SIN descargo de inventario.');
        console.log('  Siguiente paso obligatorio:');
        console.log('  1. import-recetas-xlsx.ts <plantilla.xlsx> --apply --create-missing [--prune]');
        console.log('  2. Re-vincular platos → recetas (hoja MENU_ITEMS de la plantilla, o');
        console.log('     scripts/relink-menu-recipes.ts --apply)');
        if (!APPLY) console.log('\nENSAYO — nada fue modificado. Para ejecutar: --apply --confirm=' + expectedConfirm);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
