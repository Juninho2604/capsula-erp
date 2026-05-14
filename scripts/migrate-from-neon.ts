/**
 * migrate-from-neon.ts
 * --------------------
 * Migra datos de la BD de Neon (Table Pong / Sello Criollo originales) a
 * kpsula-erp como tenant nuevo. Lee de Neon (read-only), escribe en
 * kpsula-erp con `tenantId` inyectado.
 *
 * Uso:
 *   set -a && source /var/www/capsula-erp/.env && set +a && \
 *   npx tsx scripts/migrate-from-neon.ts \
 *     --neon-url="postgresql://..." \
 *     --target-tenant-slug=tablepong \
 *     [--dry-run]                    # cuenta sin insertar
 *     [--only=Branch,User,Area]      # solo estas tablas
 *     [--skip=AuditLog]              # excluir estas tablas
 *
 * Precondición: el tenant target ya debe existir (creado con create-tenant.ts).
 *
 * Comportamiento por tabla:
 *   - Si está en `MIGRATION_PLAN` con `skip: true` → no se toca.
 *   - Si tiene `columnRenames` → renombra cols Neon → target.
 *   - Si tiene `targetDefaults` → llena cols del target que no existen en Neon.
 *   - Inyecta `tenantId` si la tabla lo soporta en kpsula-erp.
 *   - Si falla una fila, loguea el error y sigue con la siguiente (modo
 *     best-effort). Cuenta éxito/fallos al final.
 *
 * Orden de tablas: respeta FKs (Branch antes que Area, etc.).
 *
 * IDs: se preservan los cuids de Neon (la colisión con kpsula-erp es
 * astronómicamente improbable y, si pasara, la insert falla y se loguea).
 */

import { Client as PgClient } from 'pg';
import { PrismaClient } from '@prisma/client';

// ─── Args ───────────────────────────────────────────────────────────────────

interface Args {
    neonUrl: string;
    targetTenantSlug: string;
    dryRun: boolean;
    only: Set<string> | null;
    skipTables: Set<string>;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    if (!map['neon-url']) {
        console.error('Falta --neon-url=postgresql://...');
        process.exit(1);
    }
    if (!map['target-tenant-slug']) {
        console.error('Falta --target-tenant-slug=tablepong');
        process.exit(1);
    }
    return {
        neonUrl: map['neon-url'],
        targetTenantSlug: map['target-tenant-slug'],
        dryRun: map['dry-run'] === 'true',
        only: map['only'] ? new Set(map['only'].split(',').map((s) => s.trim())) : null,
        skipTables: new Set((map['skip'] ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0)),
    };
}

// ─── Plan de migración por tabla ────────────────────────────────────────────

interface TableConfig {
    name: string;
    fkOrder: number;
    skip?: boolean;
    skipReason?: string;
    columnRenames?: Record<string, string>;
    targetDefaults?: Record<string, any>;
    dropFromNeon?: string[];
}

/**
 * Orden de inserción respeta FKs.
 * - Tier 1: sin dependencias (Branch, ProductFamily, etc.)
 * - Tier 2: depende de Tier 1
 * - etc.
 *
 * Por simplicidad usamos fkOrder numérico. Mismo número = pueden ir en
 * cualquier orden entre ellas pero después de los menores.
 */
const MIGRATION_PLAN: TableConfig[] = [
    // ── Tier 1: roots ─────────────────────────────────────────────────────
    { name: 'Branch', fkOrder: 1 },
    { name: 'ProductFamily', fkOrder: 1, targetDefaults: { code: 'LEGACY' }, skip: true, skipReason: 'requiere code; 0 filas en Neon' },
    { name: 'GameType', fkOrder: 1, skip: true, skipReason: 'drift alto, 0 filas en Neon' },
    { name: 'ExchangeRate', fkOrder: 1 },
    { name: 'ExpenseCategory', fkOrder: 1 },
    { name: 'Supplier', fkOrder: 1 },

    // ── Tier 2: depende de Tier 1 ────────────────────────────────────────
    { name: 'Area', fkOrder: 2 },
    { name: 'ServiceZone', fkOrder: 2 },
    { name: 'User', fkOrder: 2 },
    { name: 'MenuModifierGroup', fkOrder: 2 },
    { name: 'MenuCategory', fkOrder: 2 },
    { name: 'SkuCreationTemplate', fkOrder: 2, skip: true, skipReason: 'drift alto, 0 filas' },
    { name: 'BroadcastMessage', fkOrder: 2, columnRenames: { kind: 'type' }, dropFromNeon: ['updatedAt'], targetDefaults: { targetRoles: '["OWNER"]' } },
    { name: 'WristbandPlan', fkOrder: 2, skip: true, skipReason: 'drift alto, 0 filas' },
    { name: 'IntercompanyItemMapping', fkOrder: 2, skip: true, skipReason: 'drift alto, 0 filas' },

    // ── Tier 3 ────────────────────────────────────────────────────────────
    { name: 'TableOrStation', fkOrder: 3 },
    { name: 'MenuItem', fkOrder: 3, dropFromNeon: ['intercompanySupplierCode', 'isIntercompany', 'intercompanySupplierId'] },
    { name: 'InventoryItem', fkOrder: 3, columnRenames: { familyId: 'productFamilyId' }, dropFromNeon: ['productRole'] },
    { name: 'MenuModifier', fkOrder: 3 },
    { name: 'GameStation', fkOrder: 3, skip: true, skipReason: 'drift alto, 0 filas' },
    { name: 'ProcessingTemplate', fkOrder: 3 },
    { name: 'Reservation', fkOrder: 3, skip: true, skipReason: 'drift alto, 0 filas' },
    { name: 'AreaCriticalItem', fkOrder: 3 },
    { name: 'SystemConfig', fkOrder: 3, skip: true, skipReason: '0 filas en Neon — usa defaults en kpsula' },
    { name: 'Customer', fkOrder: 3, skip: true, skipReason: 'drift alto, 0 filas en Neon' },

    // ── Tier 4 ────────────────────────────────────────────────────────────
    { name: 'Recipe', fkOrder: 4 },
    { name: 'MenuItemModifierGroup', fkOrder: 4 },
    { name: 'GameSession', fkOrder: 4, skip: true, skipReason: 'drift alto, 0 filas' },
    { name: 'ProcessingTemplateOutput', fkOrder: 4 },
    { name: 'SupplierItem', fkOrder: 4 },
    { name: 'AccountPayable', fkOrder: 4, dropFromNeon: ['deletedAt', 'deletedById'] },
    { name: 'PurchaseOrder', fkOrder: 4 },
    { name: 'ProductionOrder', fkOrder: 4 },
    { name: 'ProteinProcessing', fkOrder: 4 },
    { name: 'Requisition', fkOrder: 4 },
    { name: 'InventoryAudit', fkOrder: 4 },
    { name: 'InventoryLoan', fkOrder: 4 },
    { name: 'InventoryCycle', fkOrder: 4, skip: true, skipReason: 'drift alto, 1 fila — migrar manual si querés' },
    { name: 'DailyInventory', fkOrder: 4 },
    { name: 'OpenTab', fkOrder: 4, dropFromNeon: ['parentTabId', 'preBillPrintCount', 'splitIndex', 'customerId'] },
    { name: 'CostHistory', fkOrder: 4 },
    { name: 'InventoryLocation', fkOrder: 4 },
    { name: 'AuditLog', fkOrder: 4, dropFromNeon: ['branchId'] },
    { name: 'QueueTicket', fkOrder: 4, skip: true, skipReason: 'drift alto, 0 filas' },
    { name: 'InventoryMovement', fkOrder: 4 },
    { name: 'Expense', fkOrder: 4, dropFromNeon: ['deletedAt', 'deletedById'] },

    // ── Tier 5 ────────────────────────────────────────────────────────────
    { name: 'RecipeIngredient', fkOrder: 5 },
    { name: 'PurchaseOrderItem', fkOrder: 5 },
    { name: 'AccountPayment', fkOrder: 5 },
    { name: 'RequisitionItem', fkOrder: 5 },
    { name: 'InventoryAuditItem', fkOrder: 5 },
    { name: 'InventoryCycleSnapshot', fkOrder: 5, skip: true, skipReason: 'drift alto + 0 filas (depende de InventoryCycle skip)' },
    { name: 'DailyInventoryItem', fkOrder: 5 },
    { name: 'ProteinSubProduct', fkOrder: 5 },
    { name: 'OpenTabOrder', fkOrder: 5 },
    { name: 'PaymentSplit', fkOrder: 5, dropFromNeon: ['amountReceived', 'changeReturned', 'serviceChargeRate'] },
    { name: 'SalesOrder', fkOrder: 5, dropFromNeon: ['customerId'] },

    // ── Tier 6 ────────────────────────────────────────────────────────────
    { name: 'SalesOrderItem', fkOrder: 6, dropFromNeon: ['intercompanyUnitPrice', 'isIntercompany', 'intercompanySupplierId'] },
    { name: 'IntercompanySettlement', fkOrder: 6, skip: true, skipReason: 'drift alto, 0 filas' },

    // ── Tier 7 ────────────────────────────────────────────────────────────
    { name: 'SalesOrderItemModifier', fkOrder: 7 },
    { name: 'IntercompanySettlementLine', fkOrder: 7, skip: true, skipReason: 'drift alto, 0 filas' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getColumnsFromTarget(prisma: PrismaClient, tableName: string): Promise<Map<string, { isNullable: boolean; hasDefault: boolean }>> {
    const cols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string; column_default: string | null }[]>(
        `SELECT column_name, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'`,
        tableName,
    );
    const map = new Map<string, { isNullable: boolean; hasDefault: boolean }>();
    for (const c of cols) {
        map.set(c.column_name, { isNullable: c.is_nullable === 'YES', hasDefault: c.column_default !== null });
    }
    return map;
}

async function getColumnsFromNeon(neon: PgClient, tableName: string): Promise<Set<string>> {
    const res = await neon.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'`,
        [tableName],
    );
    return new Set(res.rows.map((r: { column_name: string }) => r.column_name));
}

// Lowercase first letter — Prisma model name → client property name
function lcfirst(s: string): string {
    return s.charAt(0).toLowerCase() + s.slice(1);
}

// ─── Migrar una tabla ───────────────────────────────────────────────────────

interface MigrationResult {
    table: string;
    neonRows: number;
    inserted: number;
    failed: number;
    skipped: boolean;
    skipReason?: string;
    errors: string[];
}

async function migrateTable(
    neon: PgClient,
    prisma: PrismaClient,
    config: TableConfig,
    tenantId: string,
    dryRun: boolean,
): Promise<MigrationResult> {
    const result: MigrationResult = {
        table: config.name,
        neonRows: 0,
        inserted: 0,
        failed: 0,
        skipped: false,
        errors: [],
    };

    if (config.skip) {
        result.skipped = true;
        result.skipReason = config.skipReason;
        return result;
    }

    const neonCols = await getColumnsFromNeon(neon, config.name);
    const targetCols = await getColumnsFromTarget(prisma, config.name);

    // Build column set to SELECT from Neon: all columns common, after applying renames.
    const targetHasTenantId = targetCols.has('tenantId');
    const colsToSelect: string[] = [];
    const colsToMap: { neonName: string; targetName: string }[] = [];
    const dropSet = new Set(config.dropFromNeon ?? []);

    for (const neonCol of neonCols) {
        if (dropSet.has(neonCol)) continue;
        const targetName = config.columnRenames?.[neonCol] ?? neonCol;
        if (!targetCols.has(targetName)) continue; // target no tiene la col → ignorar
        colsToSelect.push(neonCol);
        colsToMap.push({ neonName: neonCol, targetName });
    }

    if (colsToSelect.length === 0) {
        result.errors.push('Sin columnas comunes para migrar');
        return result;
    }

    // Fetch rows from Neon
    const cols = colsToSelect.map((c) => `"${c}"`).join(', ');
    const neonRes = await neon.query(`SELECT ${cols} FROM "${config.name}"`);
    const rows = neonRes.rows;
    result.neonRows = rows.length;

    if (dryRun) {
        return result;
    }

    if (rows.length === 0) {
        return result;
    }

    // Get prisma client for this model
    const modelName = lcfirst(config.name);
    const model = (prisma as any)[modelName];
    if (!model || typeof model.create !== 'function') {
        result.errors.push(`Prisma client no tiene model "${modelName}"`);
        return result;
    }

    // Insert row by row (best-effort)
    for (const row of rows) {
        const data: any = {};
        // Map columns from Neon name → target name
        for (const { neonName, targetName } of colsToMap) {
            data[targetName] = row[neonName];
        }
        // Apply targetDefaults for cols that we don't have value for
        if (config.targetDefaults) {
            for (const [col, val] of Object.entries(config.targetDefaults)) {
                if (!(col in data)) data[col] = val;
            }
        }
        // Inject tenantId if target supports it
        if (targetHasTenantId) {
            data.tenantId = tenantId;
        }
        try {
            await model.create({ data });
            result.inserted++;
        } catch (err) {
            result.failed++;
            const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
            // Limitar logs: solo los primeros 3 errores por tabla
            if (result.errors.length < 3) {
                result.errors.push(`Fila ${result.inserted + result.failed}: ${msg}`);
            }
        }
    }

    return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();

    console.log('==================================================');
    console.log(' Migración Neon → kpsula-erp');
    console.log('==================================================');
    console.log(`  Target tenant slug:  ${args.targetTenantSlug}`);
    console.log(`  Modo:                ${args.dryRun ? 'DRY RUN (no inserta)' : 'REAL (inserta)'}`);
    if (args.only) console.log(`  Solo tablas:         ${[...args.only].join(', ')}`);
    if (args.skipTables.size > 0) console.log(`  Skip extra:          ${[...args.skipTables].join(', ')}`);
    console.log('');

    const neon = new PgClient({ connectionString: args.neonUrl });
    await neon.connect();
    const prisma = new PrismaClient();

    try {
        // Lookup tenant by slug
        const tenant = await prisma.tenant.findUnique({
            where: { slug: args.targetTenantSlug },
            select: { id: true, name: true },
        });
        if (!tenant) {
            console.error(`Tenant con slug "${args.targetTenantSlug}" no existe. Creálo primero con create-tenant.ts.`);
            process.exit(1);
        }
        console.log(`  Tenant target:       ${tenant.name} (id: ${tenant.id})`);
        console.log('');

        // Sort plan by fkOrder
        const sortedPlan = [...MIGRATION_PLAN].sort((a, b) => a.fkOrder - b.fkOrder);

        const results: MigrationResult[] = [];
        for (const config of sortedPlan) {
            if (args.only && !args.only.has(config.name)) continue;
            if (args.skipTables.has(config.name)) {
                results.push({ table: config.name, neonRows: 0, inserted: 0, failed: 0, skipped: true, skipReason: 'usuario pidió --skip', errors: [] });
                continue;
            }

            process.stdout.write(`[${config.name}] `);
            try {
                const r = await migrateTable(neon, prisma, config, tenant.id, args.dryRun);
                results.push(r);
                if (r.skipped) {
                    console.log(`SKIP — ${r.skipReason}`);
                } else if (args.dryRun) {
                    console.log(`${r.neonRows} filas (dry-run)`);
                } else {
                    console.log(`${r.inserted} inserted, ${r.failed} failed, de ${r.neonRows} en Neon`);
                    for (const e of r.errors) console.log(`   ↳ ${e}`);
                }
            } catch (err) {
                console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
                results.push({ table: config.name, neonRows: 0, inserted: 0, failed: 1, skipped: false, errors: [String(err)] });
            }
        }

        // Resumen
        console.log('');
        console.log('==================================================');
        console.log(' Resumen');
        console.log('==================================================');
        const totalRows = results.reduce((s, r) => s + r.neonRows, 0);
        const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
        const totalFailed = results.reduce((s, r) => s + r.failed, 0);
        const totalSkipped = results.filter((r) => r.skipped).length;
        console.log(`  Tablas procesadas:   ${results.length}`);
        console.log(`  Tablas saltadas:     ${totalSkipped}`);
        console.log(`  Total filas en Neon: ${totalRows}`);
        console.log(`  Total inserted:      ${totalInserted}`);
        console.log(`  Total failed:        ${totalFailed}`);
        console.log('');
        if (totalFailed > 0) {
            console.log('Tablas con errores:');
            for (const r of results) {
                if (r.failed > 0) {
                    console.log(`  - ${r.table}: ${r.failed} errores`);
                    for (const e of r.errors) console.log(`    ↳ ${e}`);
                }
            }
        }
    } finally {
        await neon.end();
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Error fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
});
