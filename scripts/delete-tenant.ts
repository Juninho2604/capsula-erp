/**
 * delete-tenant.ts
 * ----------------
 * Borra un tenant completo y TODA su data en cascada respetando FKs.
 * Solo para tenants de test o demo abandonado — NUNCA correr sobre un
 * tenant productivo (Shanklish, etc.).
 *
 * Defensa: el script tiene una blocklist de tenant IDs/slugs que NO se
 * pueden borrar bajo ninguna circunstancia (Shanklish, KPSULA admin).
 * Si querés borrar algo distinto, agregalo a la allowlist explícita.
 *
 * Uso:
 *   set -a && source /var/www/capsula-erp/.env && set +a && \
 *   npx tsx scripts/delete-tenant.ts --id=<tenantId>
 *
 * Flags:
 *   --id=<tenantId>    OBLIGATORIO. ID interno del tenant (no slug).
 *   --dry-run          Default. Muestra qué borraría sin tocar BD.
 *   --apply            Ejecuta el DELETE de verdad. Sin esto, dry-run.
 *
 * Pre-flight checks (siempre, incluso en --apply):
 *   1. Tenant existe en BD.
 *   2. Tenant NO está en BLOCKED_TENANTS.
 *   3. Tenant está en ALLOWED_TENANTS.
 *   4. Backup de BD reciente (avisa si no hay uno del día).
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─── Args ───────────────────────────────────────────────────────────────────

interface Args {
    id: string | null;
    apply: boolean;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    return {
        id: map['id'] ?? null,
        apply: map['apply'] === 'true',
    };
}

// ─── Safety lists ──────────────────────────────────────────────────────────

// HARD BLOCK: nunca borrar. Incluye productivo + admin + demo. Si por error
// llega aquí un id de la blocklist, abortamos sin importar otros flags.
const BLOCKED_TENANTS = new Set<string>([
    'tnt_shanklish_caracas',
    'tnt_kpsula_admin',
    'cmp5y3f4w000011mxdzvwqyls', // demo
]);

// ALLOWLIST: solo IDs explícitos pueden borrarse. Mantenerla mínima y
// auditada en code review.
const ALLOWED_TENANTS = new Set<string>([
    'cmp4ap2bt0001rof8px6bs7f8', // testtenant (1 user, sin data productiva)
]);

// ─── Backup check ──────────────────────────────────────────────────────────

function hasRecentBackup(): { found: boolean; latest?: string } {
    const dir = '/root/backups';
    if (!existsSync(dir)) return { found: false };
    const files = readdirSync(dir).filter((f) => f.endsWith('.dump'));
    if (files.length === 0) return { found: false };
    const latest = files
        .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
    const ageMs = Date.now() - latest.mtime.getTime();
    const ageH = ageMs / (60 * 60 * 1000);
    return { found: ageH < 24, latest: `${latest.name} (${ageH.toFixed(1)}h)` };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();

    console.log('======================================================');
    console.log(' Delete Tenant');
    console.log('======================================================');
    console.log(`  ID:        ${args.id ?? '(falta --id)'}`);
    console.log(`  Mode:      ${args.apply ? 'APPLY (modifica BD)' : 'DRY-RUN'}`);
    console.log('');

    if (!args.id) {
        console.error('ABORT: falta --id=<tenantId>');
        process.exit(1);
    }
    if (BLOCKED_TENANTS.has(args.id)) {
        console.error(`ABORT: tenant ${args.id} está en BLOCKED_TENANTS. NUNCA se borra.`);
        process.exit(1);
    }
    if (!ALLOWED_TENANTS.has(args.id)) {
        console.error(`ABORT: tenant ${args.id} no está en ALLOWED_TENANTS.`);
        console.error('Agregalo explícitamente al código si querés borrarlo (requiere PR).');
        process.exit(1);
    }

    // Chequeo de backup (warning, no abort en dry-run)
    if (args.apply) {
        const backup = hasRecentBackup();
        if (!backup.found) {
            console.error('ABORT: no se detectó backup BD de las últimas 24h en /root/backups.');
            console.error('Corré primero: ./scripts/deploy-vps.sh (genera backup) o pg_dump manual.');
            process.exit(1);
        }
        console.log(`✓ Backup reciente: ${backup.latest}`);
        console.log('');
    }

    const prisma = new PrismaClient();
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: args.id },
            select: { id: true, slug: true, name: true, createdAt: true },
        });
        if (!tenant) {
            console.error(`ABORT: tenant ${args.id} no existe en BD.`);
            process.exit(1);
        }

        console.log(`Tenant: ${tenant.name} (${tenant.slug ?? 'sin slug'})`);
        console.log(`Created: ${tenant.createdAt.toISOString()}`);
        console.log('');

        // ─── Conteo de data para visibilidad ────────────────────────────
        console.log('Data en cascada (counts):');
        const counts = await countTenantData(prisma, tenant.id);
        for (const [table, n] of Object.entries(counts)) {
            const flag = n > 0 ? '•' : ' ';
            console.log(`  ${flag} ${table.padEnd(28)} ${n}`);
        }
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        console.log(`  ${'─'.repeat(35)}`);
        console.log(`    TOTAL filas a borrar:       ${total}`);
        console.log('');

        if (!args.apply) {
            console.log('Dry-run completado. Para aplicar:');
            console.log(`  npx tsx scripts/delete-tenant.ts --id=${args.id} --apply`);
            return;
        }

        // ─── Cascade delete ─────────────────────────────────────────────
        console.log('Borrando en cascada...');
        await deleteTenantCascade(prisma, tenant.id);
        console.log('');
        console.log('✓ Tenant borrado completamente.');
    } finally {
        await prisma.$disconnect();
    }
}

// ─── Counts ────────────────────────────────────────────────────────────────

async function countTenantData(prisma: PrismaClient, tenantId: string): Promise<Record<string, number>> {
    const where = { tenantId };
    // Counts en paralelo para velocidad. Cada modelo que no exista en
    // schema actual se ignora silenciosamente con un catch.
    const [
        users, sales, salesItems, openTabs, expenses, expenseCats,
        invItems, menuItems, menuCats, tables, zones, waiters,
        areas, branches, exchangeRates, suppliers, customers,
    ] = await Promise.all([
        prisma.user.count({ where }).catch(() => 0),
        prisma.salesOrder.count({ where }).catch(() => 0),
        prisma.salesOrderItem.count({ where }).catch(() => 0),
        prisma.openTab.count({ where }).catch(() => 0),
        prisma.expense.count({ where }).catch(() => 0),
        prisma.expenseCategory.count({ where }).catch(() => 0),
        prisma.inventoryItem.count({ where }).catch(() => 0),
        prisma.menuItem.count({ where }).catch(() => 0),
        prisma.menuCategory.count({ where }).catch(() => 0),
        prisma.tableOrStation.count({ where }).catch(() => 0),
        prisma.serviceZone.count({ where }).catch(() => 0),
        prisma.waiter.count({ where }).catch(() => 0),
        prisma.area.count({ where }).catch(() => 0),
        prisma.branch.count({ where }).catch(() => 0),
        prisma.exchangeRate.count({ where }).catch(() => 0),
        prisma.supplier.count({ where }).catch(() => 0),
        prisma.customer.count({ where }).catch(() => 0),
    ]);

    return {
        User: users, SalesOrder: sales, SalesOrderItem: salesItems,
        OpenTab: openTabs, Expense: expenses, ExpenseCategory: expenseCats,
        InventoryItem: invItems, MenuItem: menuItems, MenuCategory: menuCats,
        TableOrStation: tables, ServiceZone: zones, Waiter: waiters,
        Area: areas, Branch: branches, ExchangeRate: exchangeRates,
        Supplier: suppliers, Customer: customers,
    };
}

// ─── Cascade delete ────────────────────────────────────────────────────────

async function deleteTenantCascade(prisma: PrismaClient, tenantId: string) {
    // Orden inverso de FKs (children primero). Cada deleteMany es idempotente
    // (no error si no hay filas). Si un modelo no existe en schema actual,
    // el catch lo skipea silenciosamente.
    const ops: { table: string; fn: () => Promise<unknown> }[] = [
        // Ventas y derivados
        { table: 'SalesOrderItem', fn: () => prisma.salesOrderItem.deleteMany({ where: { tenantId } }) },
        { table: 'SalesOrder',     fn: () => prisma.salesOrder.deleteMany({ where: { tenantId } }) },
        { table: 'OpenTab',        fn: () => prisma.openTab.deleteMany({ where: { tenantId } }) },

        // Gastos
        { table: 'Expense',         fn: () => prisma.expense.deleteMany({ where: { tenantId } }) },
        { table: 'ExpenseCategory', fn: () => prisma.expenseCategory.deleteMany({ where: { tenantId } }) },

        // Inventario (locations y costHistory van vía items)
        { table: 'InventoryLocation', fn: async () => {
            const items = await prisma.inventoryItem.findMany({ where: { tenantId }, select: { id: true } });
            for (const it of items) {
                await prisma.inventoryLocation.deleteMany({ where: { inventoryItemId: it.id } });
                await prisma.costHistory.deleteMany({ where: { inventoryItemId: it.id } });
            }
        } },
        { table: 'InventoryItem', fn: () => prisma.inventoryItem.deleteMany({ where: { tenantId } }) },

        // Menú
        { table: 'MenuItem',     fn: () => prisma.menuItem.deleteMany({ where: { tenantId } }) },
        { table: 'MenuCategory', fn: () => prisma.menuCategory.deleteMany({ where: { tenantId } }) },

        // Mesas / zonas / personal
        { table: 'TableOrStation', fn: () => prisma.tableOrStation.deleteMany({ where: { tenantId } }) },
        { table: 'ServiceZone',    fn: () => prisma.serviceZone.deleteMany({ where: { tenantId } }) },
        { table: 'Waiter',         fn: () => prisma.waiter.deleteMany({ where: { tenantId } }) },

        // Estructura
        { table: 'Area',          fn: () => prisma.area.deleteMany({ where: { tenantId } }) },
        { table: 'Branch',        fn: () => prisma.branch.deleteMany({ where: { tenantId } }) },
        { table: 'ExchangeRate',  fn: () => prisma.exchangeRate.deleteMany({ where: { tenantId } }) },
        { table: 'Supplier',      fn: () => prisma.supplier.deleteMany({ where: { tenantId } }) },
        { table: 'Customer',      fn: () => prisma.customer.deleteMany({ where: { tenantId } }) },

        // Users
        { table: 'User', fn: () => prisma.user.deleteMany({ where: { tenantId } }) },

        // Por último el tenant
        { table: 'Tenant', fn: () => prisma.tenant.delete({ where: { id: tenantId } }) },
    ];

    for (const op of ops) {
        try {
            const r = await op.fn();
            // Algunos ops devuelven {count}, otros devuelven el record borrado.
            // No imprimimos count para no romper el formato; con que no tire
            // alcanza.
            void r;
            console.log(`  ✓ ${op.table}`);
        } catch (err) {
            // Si el modelo no existe en este schema, lo skipeamos. Si es otra
            // cosa (FK violation, etc.), lo reportamos y abortamos.
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('Unknown') || msg.includes('does not exist')) {
                console.log(`  - ${op.table} (modelo no existe, skip)`);
                continue;
            }
            throw err;
        }
    }
}

main().catch((err) => {
    console.error('Error fatal:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
});
