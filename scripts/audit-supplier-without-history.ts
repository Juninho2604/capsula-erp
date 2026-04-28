/**
 * AUDIT — Supplier Pricing Coverage (read-only)
 * ───────────────────────────────────────────────────────────────────────────
 * Diagnostica la calidad de la trazabilidad de precios por proveedor:
 *
 *   1. SupplierItems sin precio (unitPrice = 0) — el formulario de OC
 *      no podrá pre-llenar.
 *   2. Items con múltiples proveedores y NINGUNO marcado como isPreferred
 *      — bloquea sugerencias automáticas en compras.
 *   3. Items con precios SOSPECHOSAMENTE OBSOLETOS — el campo
 *      SupplierItem.updatedAt no refleja recepciones reales (Fase 3 añade
 *      SupplierItemPriceHistory). Como proxy, comparamos vs último
 *      CostHistory del item: si el costHistory es más reciente que el
 *      SupplierItem.updatedAt por más de 60 días, el SupplierItem está
 *      desactualizado.
 *   4. Suppliers totalmente sin items asignados.
 *
 * Solo lectura. NO modifica BD.
 *
 * Uso:
 *   npx tsx scripts/audit-supplier-without-history.ts
 *   npx tsx scripts/audit-supplier-without-history.ts --csv > out.csv
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CSV_FLAG = process.argv.includes('--csv');
const STALE_DAYS = 60;

async function main() {
    // 1) SupplierItems sin precio
    const noPrice = await prisma.supplierItem.findMany({
        where: { unitPrice: { lte: 0 } },
        include: {
            supplier: { select: { name: true, code: true } },
            inventoryItem: { select: { name: true, sku: true } },
        },
        orderBy: { updatedAt: 'desc' },
    });

    // 2) InventoryItems con varios SupplierItems pero ninguno preferido
    const itemsWithMultipleSuppliers = await prisma.inventoryItem.findMany({
        where: {
            deletedAt: null,
            isActive: true,
        },
        include: {
            suppliers: {
                include: { supplier: { select: { name: true, code: true } } },
            },
        },
    });
    const noPreferred = itemsWithMultipleSuppliers
        .filter(i => i.suppliers.length > 1 && !i.suppliers.some(s => s.isPreferred))
        .map(i => ({
            sku: i.sku,
            name: i.name,
            suppliersCount: i.suppliers.length,
            suppliers: i.suppliers.map(s => s.supplier.name).join(', '),
        }));

    // 3) SupplierItems desactualizados vs CostHistory
    const supplierItems = await prisma.supplierItem.findMany({
        where: { unitPrice: { gt: 0 } },
        include: {
            supplier: { select: { name: true, code: true } },
            inventoryItem: {
                select: {
                    id: true, name: true, sku: true,
                    costHistory: {
                        orderBy: { effectiveFrom: 'desc' },
                        take: 1,
                        select: { effectiveFrom: true, costPerUnit: true },
                    },
                },
            },
        },
    });

    const stale = supplierItems
        .map(si => {
            const latestCost = si.inventoryItem.costHistory[0];
            if (!latestCost) return null;
            const supplierUpdatedAt = si.updatedAt.getTime();
            const costEffective = latestCost.effectiveFrom.getTime();
            const lagDays = Math.round((costEffective - supplierUpdatedAt) / 86400_000);
            if (lagDays >= STALE_DAYS) {
                return {
                    supplier: si.supplier.name,
                    sku: si.inventoryItem.sku,
                    item: si.inventoryItem.name,
                    supplierPrice: Number(si.unitPrice),
                    latestCost: Number(latestCost.costPerUnit),
                    diffPct: si.unitPrice > 0
                        ? `${(((Number(latestCost.costPerUnit) - Number(si.unitPrice)) / Number(si.unitPrice)) * 100).toFixed(1)}%`
                        : 'n/a',
                    lagDays,
                };
            }
            return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.lagDays - a.lagDays);

    // 4) Suppliers sin items
    const orphanSuppliers = await prisma.supplier.findMany({
        where: {
            isActive: true,
            suppliedItems: { none: {} },
        },
        select: { id: true, name: true, code: true, contactName: true },
    });

    if (CSV_FLAG) {
        console.log('section,sku,name,detail');
        for (const r of noPrice) {
            console.log(`"NO_PRICE","${r.inventoryItem.sku}","${r.inventoryItem.name}","supplier=${r.supplier.name}"`);
        }
        for (const r of noPreferred) {
            console.log(`"NO_PREFERRED","${r.sku}","${r.name}","${r.suppliers}"`);
        }
        for (const r of stale) {
            console.log(`"STALE_PRICE","${r.sku}","${r.item}","supplier=${r.supplier} lag=${r.lagDays}d diff=${r.diffPct}"`);
        }
        for (const r of orphanSuppliers) {
            console.log(`"ORPHAN_SUPPLIER","","${r.name}","contacto=${r.contactName ?? ''}"`);
        }
        process.exit(0);
    }

    console.log('\n=== AUDIT: Supplier Pricing Coverage (read-only) ===\n');
    console.log(`SupplierItems sin precio (unitPrice <= 0):     ${noPrice.length}`);
    console.log(`Items con varios proveedores sin preferido:    ${noPreferred.length}`);
    console.log(`SupplierItems con precio obsoleto (>${STALE_DAYS} días): ${stale.length}`);
    console.log(`Suppliers activos sin items asignados:         ${orphanSuppliers.length}\n`);

    if (noPrice.length > 0) {
        console.log('--- SupplierItems sin precio (top 20) ---');
        console.table(noPrice.slice(0, 20).map(r => ({
            supplier: r.supplier.name,
            sku: r.inventoryItem.sku,
            item: r.inventoryItem.name,
        })));
    }

    if (noPreferred.length > 0) {
        console.log('\n--- Items con varios proveedores sin preferido (top 20) ---');
        console.table(noPreferred.slice(0, 20));
    }

    if (stale.length > 0) {
        console.log('\n--- Precios SupplierItem obsoletos vs CostHistory (top 20) ---');
        console.table(stale.slice(0, 20));
    }

    if (orphanSuppliers.length > 0) {
        console.log('\n--- Suppliers sin items asignados ---');
        console.table(orphanSuppliers.map(s => ({
            code: s.code, name: s.name, contact: s.contactName ?? '—',
        })));
    }

    const total = noPrice.length + noPreferred.length + stale.length + orphanSuppliers.length;
    if (total === 0) {
        console.log('Sin hallazgos. La cobertura de precios por proveedor está sana.');
    } else {
        console.log(`\nTotal hallazgos: ${total}`);
        console.log('Sugerencia: añadir --csv para exportar a archivo.');
    }
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
