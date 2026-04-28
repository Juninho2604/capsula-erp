/**
 * VERIFY — Phase 2 micro migrations (read-only smoke test)
 * ───────────────────────────────────────────────────────────────────────────
 * Confirma que las dos tablas additive de Fase 2 existen y son accesibles
 * desde el cliente Prisma. Solo SELECT — no escribe nada.
 *
 * Uso
 * ---
 *   npx tsx scripts/verify-phase2-migrations.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tableExists(tableName: string): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        ) AS exists`,
        tableName,
    );
    return rows[0]?.exists ?? false;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2
        ) AS exists`,
        tableName,
        indexName,
    );
    return rows[0]?.exists ?? false;
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Phase 2 micro — verify migrations');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let issues = 0;

    // 1. InventoryDeductionRetry
    console.log('▸ InventoryDeductionRetry');
    const idrExists = await tableExists('InventoryDeductionRetry');
    if (!idrExists) {
        console.log('  ✗  Tabla NO existe.');
        issues++;
    } else {
        console.log('  ✓  Tabla existe.');
        try {
            const count = await prisma.inventoryDeductionRetry.count();
            console.log(`  ✓  Cliente Prisma puede consultarla — count: ${count}`);
        } catch (e) {
            console.log('  ✗  Cliente Prisma falla:', e);
            issues++;
        }

        for (const idx of [
            'InventoryDeductionRetry_status_idx',
            'InventoryDeductionRetry_nextRetryAt_idx',
            'InventoryDeductionRetry_status_nextRetryAt_idx',
            'InventoryDeductionRetry_salesOrderId_idx',
        ]) {
            const ok = await indexExists('InventoryDeductionRetry', idx);
            console.log(ok ? `  ✓  Índice ${idx}` : `  ✗  Falta índice ${idx}`);
            if (!ok) issues++;
        }
    }

    // 2. SupplierItemPriceHistory
    console.log('\n▸ SupplierItemPriceHistory');
    const siphExists = await tableExists('SupplierItemPriceHistory');
    if (!siphExists) {
        console.log('  ✗  Tabla NO existe.');
        issues++;
    } else {
        console.log('  ✓  Tabla existe.');
        try {
            const count = await prisma.supplierItemPriceHistory.count();
            console.log(`  ✓  Cliente Prisma puede consultarla — count: ${count}`);
        } catch (e) {
            console.log('  ✗  Cliente Prisma falla:', e);
            issues++;
        }

        for (const idx of [
            'SupplierItemPriceHistory_supplierId_idx',
            'SupplierItemPriceHistory_inventoryItemId_idx',
            'SupplierItemPriceHistory_effectiveFrom_idx',
            'SupplierItemPriceHistory_supplierId_inventoryItemId_idx',
            'SupplierItemPriceHistory_active_per_pair_uniq',
        ]) {
            const ok = await indexExists('SupplierItemPriceHistory', idx);
            console.log(ok ? `  ✓  Índice ${idx}` : `  ✗  Falta índice ${idx}`);
            if (!ok) issues++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (issues === 0) {
        console.log('Todas las migraciones de Fase 2 están aplicadas y operativas.');
    } else {
        console.log(`${issues} problema(s) detectado(s). Revisa el output anterior.`);
        process.exit(1);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
