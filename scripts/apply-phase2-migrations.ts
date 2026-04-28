/**
 * APPLY — Phase 2 micro migrations (controlled, idempotent, transactional)
 * ───────────────────────────────────────────────────────────────────────────
 * Aplica las dos migraciones additive-only de Fase 2:
 *
 *   1. InventoryDeductionRetry  (outbox para descargo de inventario)
 *   2. SupplierItemPriceHistory (histórico de precios por proveedor)
 *
 * Por qué este script y no `prisma migrate deploy`:
 * ----------------------------------------------------------------------------
 * El proyecto NO tiene `prisma/migrations/migration_lock.toml` ni la tabla
 * `_prisma_migrations` en la BD (probablemente se usó `prisma db push`
 * históricamente). Ejecutar `prisma migrate deploy` en este estado
 * intentaría aplicar las 27 migraciones existentes desde cero y fallaría
 * porque las tablas ya existen.
 *
 * Este script:
 *   - Conecta a process.env.DATABASE_URL.
 *   - Verifica si cada tabla nueva ya existe (idempotente).
 *   - Si no existe, aplica el SQL de migrations-proposed/ en una
 *     transacción (todo-o-nada).
 *   - Reporta éxito/fracaso por tabla.
 *
 * Cero pérdida de datos garantizada porque solo ejecuta `CREATE TABLE` y
 * `CREATE INDEX` con `IF NOT EXISTS`. Si una tabla ya existe, no la toca.
 *
 * Uso
 * ---
 *   # Desde un entorno con DATABASE_URL configurada (Render shell, local, etc.)
 *   npx tsx scripts/apply-phase2-migrations.ts
 *
 *   # Modo dry-run (no aplica, solo reporta qué haría)
 *   npx tsx scripts/apply-phase2-migrations.ts --dry-run
 *
 * Siempre se recomienda hacer un snapshot de la BD antes de ejecutar.
 * Render mantiene snapshots automáticos diarios del PostgreSQL.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

interface MigrationFile {
    file: string;
    table: string;
    description: string;
}

const MIGRATIONS: MigrationFile[] = [
    {
        file: 'prisma/migrations-proposed/001_inventory_deduction_retry.sql',
        table: 'InventoryDeductionRetry',
        description: 'Outbox para descargo de inventario fallido',
    },
    {
        file: 'prisma/migrations-proposed/002_supplier_item_price_history.sql',
        table: 'SupplierItemPriceHistory',
        description: 'Histórico de precios por par (Supplier, InventoryItem)',
    },
];

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

function loadSql(relPath: string): string {
    const absPath = join(process.cwd(), relPath);
    return readFileSync(absPath, 'utf-8');
}

async function applyMigration(m: MigrationFile): Promise<'CREATED' | 'SKIPPED' | 'DRY_RUN' | 'FAILED'> {
    const exists = await tableExists(m.table);
    if (exists) {
        console.log(`  ⊘  "${m.table}" ya existe — saltando.`);
        return 'SKIPPED';
    }

    const sql = loadSql(m.file);
    if (DRY_RUN) {
        console.log(`  →  [DRY-RUN] Aplicaría ${m.file} (${sql.length} bytes)`);
        return 'DRY_RUN';
    }

    try {
        // Aplicar todo el archivo en una sola transacción.
        // executeRawUnsafe permite múltiples statements separados por ';'.
        // Usamos $transaction explícita para que un statement fallido haga rollback.
        await prisma.$transaction([prisma.$executeRawUnsafe(sql)]);
        console.log(`  ✓  "${m.table}" creada.`);
        return 'CREATED';
    } catch (err) {
        console.error(`  ✗  Error creando "${m.table}":`, err);
        return 'FAILED';
    }
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Phase 2 micro — apply additive migrations');
    console.log(DRY_RUN ? '  Modo: DRY RUN (no se aplicará nada)' : '  Modo: APLICAR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌  DATABASE_URL no está definida. Aborto.');
        process.exit(1);
    }

    console.log(`DB: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}\n`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const m of MIGRATIONS) {
        console.log(`▸ ${m.table} — ${m.description}`);
        const result = await applyMigration(m);
        if (result === 'CREATED') created++;
        else if (result === 'SKIPPED') skipped++;
        else if (result === 'FAILED') failed++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Resumen: ${created} creadas · ${skipped} saltadas · ${failed} con error`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (failed > 0) {
        console.error('\nUna o más migraciones fallaron. La BD puede haber quedado en estado parcial.');
        console.error('Cada migración corrió en su propia transacción, así que las tablas creadas con éxito permanecen.');
        process.exit(1);
    }

    if (created === 0 && skipped === MIGRATIONS.length) {
        console.log('\nNada que hacer — todas las tablas ya existen.');
    } else if (created > 0) {
        console.log('\nListo. Verifica con: npx tsx scripts/verify-phase2-migrations.ts');
    }
}

main()
    .catch(e => {
        console.error('Error fatal:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
