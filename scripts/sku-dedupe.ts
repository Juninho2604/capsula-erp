/**
 * AUDITORÍA Y FUSIÓN DE SKUs DUPLICADOS — catálogo de inventario.
 *
 * Problema (Christian/Omar): el catálogo acumuló items repetidos por las
 * importaciones ("PEREJIL KG" vs "Perejil", "HARINA DE TRIGO" vs "Harina
 * trigo kg") y categorías inconsistentes. Este script:
 *
 * MODO AUDITORÍA (default, solo lectura):
 *   npx tsx scripts/sku-dedupe.ts
 *   → Agrupa items activos por nombre normalizado (minúsculas, sin acentos,
 *     sin sufijo de unidad KG/LTS/UND…) y lista los grupos con 2+ items,
 *     con referencias de cada uno (movimientos, recetas, stock) y el
 *     canónico sugerido (el más referenciado). También reporta items sin
 *     categoría o con categoría placeholder (GENERAL / IMPORT_REVISAR).
 *
 * MODO FUSIÓN (dry-run; escribe solo con --apply):
 *   npx tsx scripts/sku-dedupe.ts --merge=SKU_DUP:SKU_CANON [--merge=...]
 *   npx tsx scripts/sku-dedupe.ts --merge-file=scripts/data/fusiones.csv
 *   npx tsx scripts/sku-dedupe.ts --merge-file=... --apply
 *   El CSV: una fila "sku_duplicado,sku_canonico" (# = comentario).
 *
 *   Por cada par (transacción por par — si algo falla, ese par queda intacto):
 *   - Re-apunta al canónico: RecipeIngredient (sumando cantidades si la
 *     receta ya usa el canónico), Recipe.outputItemId, InventoryMovement,
 *     CostHistory (cerrando el costo vigente del duplicado), RequisitionItem,
 *     PurchaseOrderItem, InventoryLoan, InventoryAuditItem,
 *     SupplierItemPriceHistory, ProteinProcessing/SubProduct,
 *     ProcessingTemplate(Output) y las referencias escalares sin FK
 *     (ProductionOrder.outputItemId, SupplierDocumentItem,
 *     IntercompanySettlementLine).
 *   - Fusiona stock: InventoryLocation del duplicado se SUMA a la del
 *     canónico por área (o se re-apunta si el canónico no tenía esa área).
 *   - Filas de conteos con unique (Daily/Weekly/Cycle/AreaCritical/
 *     SupplierItem): se re-apuntan, y si el canónico ya tiene fila en el
 *     mismo conteo/área/proveedor, la del duplicado se elimina (gana la del
 *     canónico).
 *   - Desactiva el duplicado (isActive=false) — NO se borra la fila.
 *
 *   Regla dura: ambos items deben tener la MISMA baseUnit (no convertimos
 *   unidades en silencio). Pares con unidades distintas se saltan.
 *
 * Tenant: SEED_TENANT_SLUG=<slug> (default: el más antiguo).
 * BACKUP de la BD antes de --apply.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const APPLY = process.argv.includes('--apply');
const MERGE_ARGS = process.argv.filter(a => a.startsWith('--merge=')).map(a => a.slice('--merge='.length));
const MERGE_FILE = process.argv.find(a => a.startsWith('--merge-file='))?.split('=')[1];

// ─── Normalización (misma familia que scripts/import-recetas.ts) ────────────
function norm(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}
const UNIT_SUFFIX = new Set(['KG', 'LTS', 'LT', 'L', 'UND', 'UNID', 'UNIDAD', 'UN', 'GR', 'GRS', 'G', 'ML']);
function stripUnitSuffix(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1 && UNIT_SUFFIX.has(parts[parts.length - 1].toUpperCase().replace(/\.$/, ''))) {
        return parts.slice(0, -1).join(' ');
    }
    return name;
}
const normKey = (name: string) => norm(stripUnitSuffix(name));

const PLACEHOLDER_CATEGORIES = new Set(['GENERAL', 'IMPORT_REVISAR', 'SIN CATEGORIA', 'SIN CATEGORÍA']);

interface ItemRefs {
    movements: number;
    locations: number;
    stockTotal: number;
    recipeUses: number;    // como ingrediente
    recipeOutputs: number; // recetas que lo producen
}

async function countRefs(prisma: PrismaClient, itemId: string): Promise<ItemRefs> {
    const [movements, locations, recipeUses, recipeOutputs, stockAgg] = await Promise.all([
        prisma.inventoryMovement.count({ where: { inventoryItemId: itemId } }),
        prisma.inventoryLocation.count({ where: { inventoryItemId: itemId } }),
        prisma.recipeIngredient.count({ where: { ingredientItemId: itemId, recipe: { deletedAt: null } } }),
        prisma.recipe.count({ where: { outputItemId: itemId, deletedAt: null } }),
        prisma.inventoryLocation.aggregate({ where: { inventoryItemId: itemId }, _sum: { currentStock: true } }),
    ]);
    return { movements, locations, recipeUses, recipeOutputs, stockTotal: Number(stockAgg._sum.currentStock || 0) };
}

const refScore = (r: ItemRefs) => r.movements + r.recipeUses * 10 + r.recipeOutputs * 10;

// ─── Fusión de un par ────────────────────────────────────────────────────────
async function mergePair(prisma: PrismaClient, tenantId: string, dupSku: string, canonSku: string): Promise<boolean> {
    const dup = await prisma.inventoryItem.findFirst({ where: { tenantId, sku: dupSku } });
    const canon = await prisma.inventoryItem.findFirst({ where: { tenantId, sku: canonSku } });
    if (!dup) { console.log(`  ⛔ ${dupSku}: no existe en el tenant — par saltado`); return false; }
    if (!canon) { console.log(`  ⛔ ${canonSku}: no existe en el tenant — par saltado`); return false; }
    if (dup.id === canon.id) { console.log(`  ⛔ ${dupSku}: duplicado y canónico son el mismo item — saltado`); return false; }
    if (dup.baseUnit !== canon.baseUnit) {
        console.log(`  ⛔ ${dupSku} (${dup.baseUnit}) → ${canonSku} (${canon.baseUnit}): unidades distintas, NO se fusiona (conversión manual requerida)`);
        return false;
    }

    const refs = await countRefs(prisma, dup.id);
    console.log(`  🔀 ${dup.sku} "${dup.name}" → ${canon.sku} "${canon.name}"`);
    console.log(`     mueve: ${refs.movements} movs · ${refs.recipeUses} usos en recetas · ${refs.recipeOutputs} recetas propias · stock ${refs.stockTotal} ${dup.baseUnit}`);

    if (!APPLY) return true;

    await prisma.$transaction(async (tx) => {
        // 1. RecipeIngredient (unique recipeId+ingredientItemId): sumar si choca
        const dupIngredients = await tx.recipeIngredient.findMany({ where: { ingredientItemId: dup.id } });
        for (const ri of dupIngredients) {
            const existing = await tx.recipeIngredient.findUnique({
                where: { recipeId_ingredientItemId: { recipeId: ri.recipeId, ingredientItemId: canon.id } },
            });
            if (existing) {
                await tx.recipeIngredient.update({
                    where: { id: existing.id },
                    data: { quantity: existing.quantity + ri.quantity },
                });
                await tx.recipeIngredient.delete({ where: { id: ri.id } });
            } else {
                await tx.recipeIngredient.update({ where: { id: ri.id }, data: { ingredientItemId: canon.id } });
            }
        }

        // 2. Recetas cuyo output es el duplicado
        await tx.recipe.updateMany({ where: { outputItemId: dup.id }, data: { outputItemId: canon.id } });

        // 3. Stock por área: sumar al canónico o re-apuntar
        const dupLocations = await tx.inventoryLocation.findMany({ where: { inventoryItemId: dup.id } });
        for (const loc of dupLocations) {
            const canonLoc = await tx.inventoryLocation.findUnique({
                where: { inventoryItemId_areaId: { inventoryItemId: canon.id, areaId: loc.areaId } },
            });
            if (canonLoc) {
                await tx.inventoryLocation.update({
                    where: { id: canonLoc.id },
                    data: { currentStock: { increment: loc.currentStock } },
                });
                await tx.inventoryLocation.delete({ where: { id: loc.id } });
            } else {
                await tx.inventoryLocation.update({ where: { id: loc.id }, data: { inventoryItemId: canon.id } });
            }
        }

        // 4. Historial: movimientos y costos (cerrar costo vigente del dup)
        await tx.inventoryMovement.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });
        await tx.costHistory.updateMany({
            where: { inventoryItemId: dup.id, effectiveTo: null },
            data: { effectiveTo: new Date() },
        });
        await tx.costHistory.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });

        // 5. Tablas con unique — re-apuntar; si el canónico ya tiene fila, gana la del canónico
        const mergeUnique = async (
            rows: { id: string }[],
            hasConflict: (row: any) => Promise<boolean>,
            reassign: (row: any) => Promise<void>,
            remove: (row: any) => Promise<void>,
        ) => {
            for (const row of rows) {
                if (await hasConflict(row)) await remove(row);
                else await reassign(row);
            }
        };

        await mergeUnique(
            await tx.dailyInventoryItem.findMany({ where: { inventoryItemId: dup.id } }),
            async (r) => !!(await tx.dailyInventoryItem.findUnique({ where: { dailyInventoryId_inventoryItemId: { dailyInventoryId: r.dailyInventoryId, inventoryItemId: canon.id } } })),
            async (r) => { await tx.dailyInventoryItem.update({ where: { id: r.id }, data: { inventoryItemId: canon.id } }); },
            async (r) => { await tx.dailyInventoryItem.delete({ where: { id: r.id } }); },
        );
        await mergeUnique(
            await tx.weeklyCountItem.findMany({ where: { inventoryItemId: dup.id } }),
            async (r) => !!(await tx.weeklyCountItem.findUnique({ where: { weeklyCountId_inventoryItemId: { weeklyCountId: r.weeklyCountId, inventoryItemId: canon.id } } })),
            async (r) => { await tx.weeklyCountItem.update({ where: { id: r.id }, data: { inventoryItemId: canon.id } }); },
            async (r) => { await tx.weeklyCountItem.delete({ where: { id: r.id } }); },
        );
        await mergeUnique(
            await tx.inventoryCycleSnapshot.findMany({ where: { inventoryItemId: dup.id } }),
            async (r) => !!(await tx.inventoryCycleSnapshot.findUnique({ where: { cycleId_inventoryItemId_areaId: { cycleId: r.cycleId, inventoryItemId: canon.id, areaId: r.areaId } } })),
            async (r) => { await tx.inventoryCycleSnapshot.update({ where: { id: r.id }, data: { inventoryItemId: canon.id } }); },
            async (r) => { await tx.inventoryCycleSnapshot.delete({ where: { id: r.id } }); },
        );
        await mergeUnique(
            await tx.areaCriticalItem.findMany({ where: { inventoryItemId: dup.id } }),
            async (r) => !!(await tx.areaCriticalItem.findUnique({ where: { areaId_inventoryItemId: { areaId: r.areaId, inventoryItemId: canon.id } } })),
            async (r) => { await tx.areaCriticalItem.update({ where: { id: r.id }, data: { inventoryItemId: canon.id } }); },
            async (r) => { await tx.areaCriticalItem.delete({ where: { id: r.id } }); },
        );
        await mergeUnique(
            await tx.supplierItem.findMany({ where: { inventoryItemId: dup.id } }),
            async (r) => !!(await tx.supplierItem.findUnique({ where: { supplierId_inventoryItemId: { supplierId: r.supplierId, inventoryItemId: canon.id } } })),
            async (r) => { await tx.supplierItem.update({ where: { id: r.id }, data: { inventoryItemId: canon.id } }); },
            async (r) => { await tx.supplierItem.delete({ where: { id: r.id } }); },
        );
        await mergeUnique(
            await tx.processingTemplateOutput.findMany({ where: { outputItemId: dup.id } }),
            async (r) => !!(await tx.processingTemplateOutput.findUnique({ where: { templateId_outputItemId: { templateId: r.templateId, outputItemId: canon.id } } })),
            async (r) => { await tx.processingTemplateOutput.update({ where: { id: r.id }, data: { outputItemId: canon.id } }); },
            async (r) => { await tx.processingTemplateOutput.delete({ where: { id: r.id } }); },
        );

        // 6. Referencias sin unique: updateMany directo
        await tx.requisitionItem.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });
        await tx.purchaseOrderItem.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });
        await tx.inventoryLoan.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });
        await tx.inventoryAuditItem.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });
        await tx.supplierItemPriceHistory.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });
        await tx.proteinProcessing.updateMany({ where: { sourceItemId: dup.id }, data: { sourceItemId: canon.id } });
        await tx.proteinSubProduct.updateMany({ where: { outputItemId: dup.id }, data: { outputItemId: canon.id } });
        await tx.processingTemplate.updateMany({ where: { sourceItemId: dup.id }, data: { sourceItemId: canon.id } });

        // 7. Referencias escalares sin FK
        await tx.productionOrder.updateMany({ where: { outputItemId: dup.id }, data: { outputItemId: canon.id } });
        await tx.supplierDocumentItem.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });
        await tx.intercompanySettlementLine.updateMany({ where: { inventoryItemId: dup.id }, data: { inventoryItemId: canon.id } });

        // 8. Desactivar el duplicado (reversible; la fila queda para auditoría)
        await tx.inventoryItem.update({
            where: { id: dup.id },
            data: { isActive: false, description: `[FUSIONADO → ${canon.sku}] ${dup.description ?? ''}`.trim() },
        });
    }, { timeout: 120_000 });

    console.log(`     ✔ fusionado`);
    return true;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const prisma = new PrismaClient();
    try {
        const slug = process.env.SEED_TENANT_SLUG;
        const tenant = slug
            ? await prisma.tenant.findUnique({ where: { slug } })
            : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!tenant) throw new Error('Tenant no encontrado');

        // Pares de fusión (de --merge= y/o --merge-file=)
        const pairs: Array<{ dup: string; canon: string }> = [];
        for (const m of MERGE_ARGS) {
            const [dup, canon] = m.split(':');
            if (dup && canon) pairs.push({ dup: dup.trim(), canon: canon.trim() });
        }
        if (MERGE_FILE) {
            const lines = fs.readFileSync(MERGE_FILE, 'utf8').split('\n');
            for (const line of lines) {
                const t = line.trim();
                if (!t || t.startsWith('#')) continue;
                const [dup, canon] = t.split(',');
                if (dup && canon) pairs.push({ dup: dup.trim(), canon: canon.trim() });
            }
        }

        if (pairs.length > 0) {
            // ── MODO FUSIÓN ──
            console.log(`${APPLY ? '🔥 FUSIONANDO' : '🧪 ENSAYO DE FUSIÓN (sin escribir)'} — tenant: ${tenant.name} (${tenant.slug})`);
            console.log(`Pares a procesar: ${pairs.length}\n`);
            let ok = 0, skipped = 0;
            for (const p of pairs) {
                const merged = await mergePair(prisma, tenant.id, p.dup, p.canon);
                if (merged) ok++; else skipped++;
            }
            console.log(`\n${APPLY ? 'Fusionados' : 'Se fusionarían'}: ${ok} · Saltados: ${skipped}`);
            if (!APPLY) console.log('ENSAYO — nada fue modificado. Repetí con --apply para ejecutar.');
            return;
        }

        // ── MODO AUDITORÍA ──
        console.log(`🔎 AUDITORÍA DE SKUs — tenant: ${tenant.name} (${tenant.slug})\n`);
        const items = await prisma.inventoryItem.findMany({
            where: { tenantId: tenant.id, isActive: true },
            select: { id: true, sku: true, name: true, type: true, category: true, baseUnit: true },
            orderBy: { name: 'asc' },
        });
        console.log(`Items activos: ${items.length}`);

        // Duplicados por nombre normalizado
        const groups = new Map<string, typeof items>();
        for (const it of items) {
            const key = normKey(it.name);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(it);
        }
        const dupGroups = Array.from(groups.entries()).filter(([, g]) => g.length > 1);
        console.log(`Grupos de posibles duplicados: ${dupGroups.length}\n`);

        const mergeCsvLines: string[] = ['# sku_duplicado,sku_canonico  (revisar ANTES de aplicar)'];
        for (const [key, group] of dupGroups) {
            console.log(`── "${key}" (${group.length} items)`);
            const withRefs = [];
            for (const it of group) {
                const refs = await countRefs(prisma, it.id);
                withRefs.push({ it, refs });
                console.log(
                    `   ${it.sku.padEnd(14)} "${it.name}" · ${it.type} · ${it.category ?? 'SIN CAT'} · ${it.baseUnit}` +
                    ` · ${refs.movements} movs · ${refs.recipeUses} recetas-ing · ${refs.recipeOutputs} recetas-out · stock ${refs.stockTotal}`
                );
            }
            withRefs.sort((a, b) => refScore(b.refs) - refScore(a.refs));
            const canon = withRefs[0].it;
            console.log(`   → canónico sugerido: ${canon.sku} "${canon.name}"`);
            for (const { it } of withRefs.slice(1)) {
                if (it.baseUnit === canon.baseUnit) {
                    mergeCsvLines.push(`${it.sku},${canon.sku}`);
                } else {
                    mergeCsvLines.push(`# UNIDADES DISTINTAS (${it.baseUnit} vs ${canon.baseUnit}) revisar a mano: ${it.sku},${canon.sku}`);
                }
            }
            console.log('');
        }

        // Categorización
        const noCat = items.filter(i => !i.category || PLACEHOLDER_CATEGORIES.has(i.category.toUpperCase()));
        console.log(`\nItems sin categoría real (null/GENERAL/IMPORT_REVISAR): ${noCat.length}`);
        for (const it of noCat.slice(0, 40)) {
            console.log(`   ${it.sku.padEnd(14)} "${it.name}" · cat: ${it.category ?? '—'}`);
        }
        if (noCat.length > 40) console.log(`   … y ${noCat.length - 40} más`);

        // Propuesta de fusiones lista para revisar
        if (dupGroups.length > 0) {
            const outPath = 'scripts/data/fusiones-propuestas.csv';
            fs.writeFileSync(outPath, mergeCsvLines.join('\n') + '\n');
            console.log(`\n📄 Propuesta de fusiones escrita en ${outPath}`);
            console.log('   Revisala/editala y aplicá con:');
            console.log(`   SEED_TENANT_SLUG=${tenant.slug} npx tsx scripts/sku-dedupe.ts --merge-file=${outPath}          # ensayo`);
            console.log(`   SEED_TENANT_SLUG=${tenant.slug} npx tsx scripts/sku-dedupe.ts --merge-file=${outPath} --apply  # ejecutar`);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
