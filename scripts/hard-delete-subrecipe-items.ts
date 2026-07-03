/**
 * HARD-DELETE de items de inventario tipo SUB_RECIPE — DEFINITIVO e IRREVERSIBLE.
 *
 * Borra las filas InventoryItem (type='SUB_RECIPE') del tenant junto con sus
 * dependencias operativas (stock, movimientos, costos, líneas de conteos, su
 * propia receta de preparación, etc.). NO es el soft-delete de la app
 * (isActive=false): acá las filas desaparecen de verdad.
 *
 * Un item se SALTA (no se borra, se reporta el motivo) si:
 *   - Es INGREDIENTE de una receta viva (deletedAt=null) — borrarlo cambiaría
 *     la composición de esa receta en silencio. Override: --force-ingredients
 *     borra también esas líneas RecipeIngredient (la receta queda sin ese
 *     componente y descuenta menos — revisar esas recetas después).
 *   - Tiene líneas de ÓRDENES DE COMPRA (historial de compras real).
 *   - Aparece en PROCESAMIENTO DE PROTEÍNAS o en sus plantillas.
 *   - Su receta propia tiene ÓRDENES DE PRODUCCIÓN asociadas (FK dura).
 *
 * Con el item se borran (mismo commit, transacción por item):
 *   InventoryLocation, InventoryMovement, CostHistory, WeeklyCountItem,
 *   DailyInventoryItem, InventoryAuditItem, InventoryCycleSnapshot,
 *   RequisitionItem, InventoryLoan, SupplierItem, RecipeIngredient de recetas
 *   ya soft-borradas, y su(s) Recipe propias (outputItemId) — antes se les
 *   quita el recipeId a los MenuItem que apuntaran a ellas.
 *   (AreaCriticalItem y SupplierItemPriceHistory caen por CASCADE.)
 *
 * Referencias escalares SIN foreign key (quedan colgando, solo se reportan):
 *   ProductionOrder.outputItemId, SupplierDocumentItem.inventoryItemId,
 *   IntercompanySettlementLine.inventoryItemId.
 *
 * Uso (en el VPS, con DATABASE_URL de producción):
 *   npx tsx scripts/hard-delete-subrecipe-items.ts                      # ENSAYO
 *   npx tsx scripts/hard-delete-subrecipe-items.ts --apply              # borra
 *   npx tsx scripts/hard-delete-subrecipe-items.ts --apply --force-ingredients
 *   SEED_TENANT_SLUG=<slug> ...   # tenant específico (default: el más antiguo)
 *
 * BACKUP de la BD antes de --apply. Siempre.
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const FORCE_INGREDIENTS = process.argv.includes('--force-ingredients');

interface Blockers {
    liveIngredientUses: { recipeName: string }[];
    purchaseOrderLines: number;
    proteinRefs: number;
    productionOrdersOnOwnRecipes: number;
}

async function main() {
    const prisma = new PrismaClient();
    try {
        const slug = process.env.SEED_TENANT_SLUG;
        const tenant = slug
            ? await prisma.tenant.findUnique({ where: { slug } })
            : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!tenant) throw new Error('Tenant no encontrado');

        console.log(`${APPLY ? '🔥 APLICANDO' : '🧪 ENSAYO (sin escribir)'} — tenant: ${tenant.name} (${tenant.slug})`);
        if (FORCE_INGREDIENTS) console.log('⚠️  --force-ingredients: se borrarán líneas de recetas VIVAS que usen sub-recetas');
        console.log('');

        const items = await prisma.inventoryItem.findMany({
            where: { tenantId: tenant.id, type: 'SUB_RECIPE' },
            orderBy: { name: 'asc' },
            select: { id: true, sku: true, name: true, isActive: true },
        });
        console.log(`Sub-recetas encontradas (activas e inactivas): ${items.length}\n`);
        if (items.length === 0) return;

        let deleted = 0;
        let skipped = 0;
        const skippedReport: string[] = [];

        for (const item of items) {
            // ── Bloqueadores ────────────────────────────────────────────────
            const liveIngredientRows = await prisma.recipeIngredient.findMany({
                where: { ingredientItemId: item.id, recipe: { deletedAt: null } },
                select: { id: true, recipe: { select: { name: true } } },
            });
            const [purchaseOrderLines, proteinSource, proteinOutput, templateSource, templateOutput] =
                await Promise.all([
                    prisma.purchaseOrderItem.count({ where: { inventoryItemId: item.id } }),
                    prisma.proteinProcessing.count({ where: { sourceItemId: item.id } }),
                    prisma.proteinSubProduct.count({ where: { outputItemId: item.id } }),
                    prisma.processingTemplate.count({ where: { sourceItemId: item.id } }),
                    prisma.processingTemplateOutput.count({ where: { outputItemId: item.id } }),
                ]);

            const ownRecipes = await prisma.recipe.findMany({
                where: { outputItemId: item.id },
                select: { id: true },
            });
            const ownRecipeIds = ownRecipes.map(r => r.id);
            const productionOrdersOnOwnRecipes = ownRecipeIds.length
                ? await prisma.productionOrder.count({ where: { recipeId: { in: ownRecipeIds } } })
                : 0;

            const blockers: Blockers = {
                liveIngredientUses: FORCE_INGREDIENTS ? [] : liveIngredientRows.map(r => ({ recipeName: r.recipe.name })),
                purchaseOrderLines,
                proteinRefs: proteinSource + proteinOutput + templateSource + templateOutput,
                productionOrdersOnOwnRecipes,
            };

            const blockReasons: string[] = [];
            if (blockers.liveIngredientUses.length > 0) {
                const names = Array.from(new Set(blockers.liveIngredientUses.map(u => u.recipeName)));
                blockReasons.push(`ingrediente de ${names.length} receta(s) viva(s): ${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}`);
            }
            if (blockers.purchaseOrderLines > 0) blockReasons.push(`${blockers.purchaseOrderLines} línea(s) de órdenes de compra`);
            if (blockers.proteinRefs > 0) blockReasons.push(`${blockers.proteinRefs} referencia(s) en procesamiento de proteínas`);
            if (blockers.productionOrdersOnOwnRecipes > 0) blockReasons.push(`${blockers.productionOrdersOnOwnRecipes} orden(es) de producción de su receta`);

            if (blockReasons.length > 0) {
                skipped++;
                skippedReport.push(`  ⛔ ${item.sku} · ${item.name} → ${blockReasons.join(' | ')}`);
                continue;
            }

            // ── Conteo de dependencias a borrar ─────────────────────────────
            const where = { inventoryItemId: item.id };
            const [movs, locs, costs, weekly, daily, auditLines, cycleSnaps, reqLines, loans, supplierItems] =
                await Promise.all([
                    prisma.inventoryMovement.count({ where }),
                    prisma.inventoryLocation.count({ where }),
                    prisma.costHistory.count({ where }),
                    prisma.weeklyCountItem.count({ where }),
                    prisma.dailyInventoryItem.count({ where }),
                    prisma.inventoryAuditItem.count({ where }),
                    prisma.inventoryCycleSnapshot.count({ where }),
                    prisma.requisitionItem.count({ where }),
                    prisma.inventoryLoan.count({ where }),
                    prisma.supplierItem.count({ where }),
                ]);
            const ingredientRowsToDelete = FORCE_INGREDIENTS
                ? await prisma.recipeIngredient.count({ where: { ingredientItemId: item.id } })
                : await prisma.recipeIngredient.count({ where: { ingredientItemId: item.id, recipe: { deletedAt: { not: null } } } });

            // Referencias escalares sin FK — solo informativas
            const [prodOrders, supplierDocLines, intercompanyLines] = await Promise.all([
                prisma.productionOrder.count({ where: { outputItemId: item.id } }),
                prisma.supplierDocumentItem.count({ where: { inventoryItemId: item.id } }),
                prisma.intercompanySettlementLine.count({ where: { inventoryItemId: item.id } }),
            ]);

            const parts: string[] = [];
            if (movs) parts.push(`${movs} movs`);
            if (locs) parts.push(`${locs} stock`);
            if (costs) parts.push(`${costs} costos`);
            if (weekly) parts.push(`${weekly} conteo-semanal`);
            if (daily) parts.push(`${daily} daily`);
            if (auditLines) parts.push(`${auditLines} auditoría`);
            if (cycleSnaps) parts.push(`${cycleSnaps} ciclos`);
            if (reqLines) parts.push(`${reqLines} requisiciones`);
            if (loans) parts.push(`${loans} préstamos`);
            if (supplierItems) parts.push(`${supplierItems} proveedor`);
            if (ownRecipeIds.length) parts.push(`${ownRecipeIds.length} receta(s) propia(s)`);
            if (ingredientRowsToDelete) parts.push(`${ingredientRowsToDelete} línea(s) ingrediente`);
            const dangling = prodOrders + supplierDocLines + intercompanyLines;

            console.log(`  🗑️  ${item.sku} · ${item.name}${item.isActive ? '' : ' (inactivo)'}${parts.length ? ` [${parts.join(', ')}]` : ''}${dangling ? ` ⚠️ ${dangling} ref(s) sin FK quedan colgando` : ''}`);

            if (!APPLY) { deleted++; continue; }

            await prisma.$transaction(async (tx) => {
                // Líneas donde este item es ingrediente (recetas soft-borradas,
                // o todas si --force-ingredients)
                await tx.recipeIngredient.deleteMany(
                    FORCE_INGREDIENTS
                        ? { where: { ingredientItemId: item.id } }
                        : { where: { ingredientItemId: item.id, recipe: { deletedAt: { not: null } } } }
                );
                // Recetas propias: desvincular MenuItems y borrarlas
                // (RecipeIngredient de esas recetas cae por CASCADE)
                if (ownRecipeIds.length) {
                    await tx.menuItem.updateMany({
                        where: { recipeId: { in: ownRecipeIds } },
                        data: { recipeId: null },
                    });
                    await tx.recipe.deleteMany({ where: { id: { in: ownRecipeIds } } });
                }
                await tx.inventoryMovement.deleteMany({ where });
                await tx.inventoryLocation.deleteMany({ where });
                await tx.costHistory.deleteMany({ where });
                await tx.weeklyCountItem.deleteMany({ where });
                await tx.dailyInventoryItem.deleteMany({ where });
                await tx.inventoryAuditItem.deleteMany({ where });
                await tx.inventoryCycleSnapshot.deleteMany({ where });
                await tx.requisitionItem.deleteMany({ where });
                await tx.inventoryLoan.deleteMany({ where });
                await tx.supplierItem.deleteMany({ where });
                // AreaCriticalItem y SupplierItemPriceHistory: CASCADE
                await tx.inventoryItem.delete({ where: { id: item.id } });
            }, { timeout: 60_000 });

            deleted++;
        }

        console.log('\n──────────────────────────────────────────────');
        console.log(`${APPLY ? 'Borrados' : 'Se borrarían'}: ${deleted}`);
        console.log(`Saltados (bloqueados): ${skipped}`);
        if (skippedReport.length) {
            console.log('\nDetalle de bloqueados:');
            for (const line of skippedReport) console.log(line);
            console.log('\nPara los bloqueados por "receta viva": corré primero el soft-delete de');
            console.log('esas recetas (o editálas para quitar el ingrediente), o usá --force-ingredients.');
        }
        if (!APPLY) console.log('\nENSAYO — nada fue modificado. Repetí con --apply para ejecutar.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
