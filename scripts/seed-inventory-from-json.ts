/**
 * seed-inventory-from-json.ts
 * ───────────────────────────
 * Carga (o ajusta) el inventario físico de un tenant a partir de un JSON con
 * la forma:
 *
 *   {
 *     "countDate": "YYYY-MM-DD",
 *     "reason": "Conteo físico — ...",
 *     "areas": [{ "name": "Barra", "description": "..." }, ...],
 *     "items": [
 *       {
 *         "sku": "...", "name": "...", "category": "...",
 *         "baseUnit": "UNIT"|"KG"|"L"|"G"|"ML"|"PORTION",
 *         "isBeverage": true, "isAlcoholic": true,
 *         "beverageCategory": "SPIRIT"|"BEER"|"WINE"|"SOFT_DRINK"|"WATER"|"JUICE"|null,
 *         "stock": [{ "area": "Barra", "qty": 12 }]
 *       }, ...
 *     ]
 *   }
 *
 * Caso de uso original: conteo físico Table Pong 31/05/2026.
 *
 * Semántica:
 *   - Sobrescribe el stock — currentStock en InventoryLocation queda
 *     exactamente igual a qty del JSON.
 *   - Para cada cambio (delta != 0) registra un InventoryMovement con
 *     movementType ADJUSTMENT_IN o ADJUSTMENT_OUT, dejando trazabilidad
 *     completa (referenceNumber = countDate, reason = JSON.reason).
 *   - Idempotente: si re-corrés con el mismo JSON, no genera movimientos
 *     (delta=0 → skip).
 *
 * Uso:
 *   # Dry-run (default):
 *   npx tsx scripts/seed-inventory-from-json.ts --tenant-slug=tablepong
 *
 *   # Aplicar:
 *   npx tsx scripts/seed-inventory-from-json.ts --tenant-slug=tablepong --apply
 *
 *   # User custom para los movimientos (default: primer OWNER del tenant):
 *   npx tsx scripts/seed-inventory-from-json.ts --tenant-slug=tablepong --apply --user-email=admin@x.com
 *
 *   # JSON alternativo:
 *   npx tsx scripts/seed-inventory-from-json.ts --tenant-slug=tablepong --file=scripts/data/otro.json --apply
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

type JsonStock = { area: string; qty: number };

type JsonItem = {
    sku: string;
    name: string;
    category: string;
    baseUnit: string;
    isBeverage: boolean;
    isAlcoholic: boolean;
    beverageCategory: string | null;
    stock: JsonStock[];
};

type JsonArea = { name: string; description: string | null };

type InventoryFile = {
    countDate: string;
    reason: string;
    areas: JsonArea[];
    items: JsonItem[];
};

type Args = {
    tenantSlug: string;
    file: string;
    apply: boolean;
    userEmail: string | null;
};

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    const tenantSlug = map['tenant-slug'];
    if (!tenantSlug) {
        console.error('Falta --tenant-slug. Ejemplo: --tenant-slug=tablepong');
        process.exit(2);
    }
    return {
        tenantSlug,
        file: map['file'] || 'scripts/data/inventory-tablepong-2026-05-31.json',
        apply: map['apply'] === 'true',
        userEmail: map['user-email'] || null,
    };
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('\n=== seed-inventory-from-json ===');
    console.log('Tenant: ', args.tenantSlug);
    console.log('Archivo:', args.file);
    console.log('Modo:   ', args.apply ? 'APPLY' : 'DRY-RUN');

    // 1. Cargar y validar JSON
    const raw = readFileSync(resolve(process.cwd(), args.file), 'utf-8');
    const data = JSON.parse(raw) as InventoryFile;
    if (!Array.isArray(data.items) || !Array.isArray(data.areas)) {
        console.error('JSON inválido: faltan "items" o "areas".');
        process.exit(2);
    }
    const skus = new Set(data.items.map((i) => i.sku));
    if (skus.size !== data.items.length) {
        console.error('JSON inválido: SKUs duplicados.');
        process.exit(2);
    }
    console.log(`\nJSON: ${data.areas.length} áreas, ${data.items.length} ítems, conteo ${data.countDate}`);

    // 2. Tenant
    const tenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true, slug: true, name: true },
    });
    if (!tenant) {
        console.error(`\nTenant "${args.tenantSlug}" no existe.`);
        process.exit(2);
    }
    console.log(`Tenant resuelto: ${tenant.name} (${tenant.id})`);

    // 3. User para los movimientos
    const user = args.userEmail
        ? await prisma.user.findFirst({
            where: { tenantId: tenant.id, email: args.userEmail, deletedAt: null },
            select: { id: true, email: true, role: true },
        })
        : await prisma.user.findFirst({
            where: { tenantId: tenant.id, deletedAt: null, role: { in: ['OWNER', 'ADMIN_MANAGER'] } },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, email: true, role: true },
        });
    if (!user) {
        console.error(`\nNo se encontró usuario ${args.userEmail ? args.userEmail : 'OWNER/ADMIN_MANAGER'} en tenant ${tenant.slug}.`);
        process.exit(2);
    }
    console.log(`User movimientos: ${user.email} (${user.role})`);

    // 4. Estado actual
    const existingAreas = await prisma.area.findMany({
        where: { tenantId: tenant.id, deletedAt: null },
        select: { id: true, name: true },
    });
    const areaIdByName = new Map(existingAreas.map((a) => [a.name, a.id]));

    const existingItems = await prisma.inventoryItem.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, sku: true, deletedAt: true },
    });
    const existingItemBySku = new Map(existingItems.map((i) => [i.sku, i]));

    const existingLocs = await prisma.inventoryLocation.findMany({
        where: { inventoryItem: { tenantId: tenant.id } },
        select: { inventoryItemId: true, areaId: true, currentStock: true },
    });
    const locKey = (itemId: string, areaId: string) => `${itemId}::${areaId}`;
    const existingLocByKey = new Map(existingLocs.map((l) => [locKey(l.inventoryItemId, l.areaId), l]));

    // 5. Pre-cálculo (para dry-run y para reporte)
    const stats = {
        areasCreated: 0,
        itemsCreated: 0, itemsRevived: 0, itemsUpdated: 0,
        locsCreated: 0, locsUpdated: 0, locsNoChange: 0,
        movementsIn: 0, movementsOut: 0,
        totalUnitsIn: 0, totalUnitsOut: 0,
    };

    for (const ar of data.areas) {
        if (!areaIdByName.has(ar.name)) stats.areasCreated++;
    }

    type PlannedAdjustment = {
        sku: string; name: string; area: string;
        previous: number; next: number; delta: number;
    };
    const plannedAdjustments: PlannedAdjustment[] = [];

    for (const item of data.items) {
        const ex = existingItemBySku.get(item.sku);
        if (!ex) stats.itemsCreated++;
        else if (ex.deletedAt) stats.itemsRevived++;
        else stats.itemsUpdated++;

        for (const s of item.stock) {
            const areaId = areaIdByName.get(s.area); // null si nueva
            const existingLoc = areaId && ex ? existingLocByKey.get(locKey(ex.id, areaId)) : undefined;
            const previous = existingLoc?.currentStock ?? 0;
            const delta = s.qty - previous;
            plannedAdjustments.push({ sku: item.sku, name: item.name, area: s.area, previous, next: s.qty, delta });
            if (existingLoc) {
                if (delta === 0) stats.locsNoChange++;
                else stats.locsUpdated++;
            } else {
                stats.locsCreated++;
            }
            if (delta > 0) { stats.movementsIn++; stats.totalUnitsIn += delta; }
            else if (delta < 0) { stats.movementsOut++; stats.totalUnitsOut += -delta; }
        }
    }

    if (!args.apply) {
        console.log('\n[DRY-RUN] Cambios que se aplicarían:');
        console.log(`  Áreas:        +${stats.areasCreated} nuevas`);
        console.log(`  Ítems:        +${stats.itemsCreated} nuevos, ↻${stats.itemsRevived} revividos, ~${stats.itemsUpdated} actualizados`);
        console.log(`  Stock (loc):  +${stats.locsCreated} nuevas ubicaciones, ~${stats.locsUpdated} ajustadas, =${stats.locsNoChange} sin cambio`);
        console.log(`  Movimientos:  ↑${stats.movementsIn} ADJUSTMENT_IN (+${stats.totalUnitsIn} u), ↓${stats.movementsOut} ADJUSTMENT_OUT (−${stats.totalUnitsOut} u)`);

        const interesting = plannedAdjustments.filter((p) => p.delta !== 0);
        if (interesting.length > 0) {
            console.log(`\n  Detalle de ajustes (${interesting.length}):`);
            for (const p of interesting) {
                const sign = p.delta > 0 ? `+${p.delta}` : `${p.delta}`;
                console.log(`    ${p.sku.padEnd(28)} [${p.area}]  ${p.previous} → ${p.next}  (${sign})`);
            }
        }
        console.log('\nRe-correr con --apply para escribir.');
        await prisma.$disconnect();
        return;
    }

    // 6. APPLY — upsert áreas
    for (const ar of data.areas) {
        if (areaIdByName.has(ar.name)) continue;
        const created = await prisma.area.create({
            data: { tenantId: tenant.id, name: ar.name, description: ar.description },
            select: { id: true, name: true },
        });
        areaIdByName.set(created.name, created.id);
    }

    // 7. APPLY — upsert ítems, ubicaciones y movimientos
    for (const item of data.items) {
        const upserted = await prisma.inventoryItem.upsert({
            where: { tenantId_sku: { tenantId: tenant.id, sku: item.sku } },
            update: {
                name: item.name,
                category: item.category,
                baseUnit: item.baseUnit,
                isBeverage: item.isBeverage,
                isAlcoholic: item.isAlcoholic,
                beverageCategory: item.beverageCategory,
                type: 'RAW_MATERIAL',
                isActive: true,
                deletedAt: null,
                deletedById: null,
            },
            create: {
                tenantId: tenant.id,
                sku: item.sku,
                name: item.name,
                category: item.category,
                baseUnit: item.baseUnit,
                isBeverage: item.isBeverage,
                isAlcoholic: item.isAlcoholic,
                beverageCategory: item.beverageCategory,
                type: 'RAW_MATERIAL',
                isActive: true,
            },
            select: { id: true },
        });

        for (const s of item.stock) {
            const areaId = areaIdByName.get(s.area);
            if (!areaId) {
                console.error(`Área no resuelta: "${s.area}" para ${item.sku}`);
                process.exit(2);
            }
            const existingLoc = existingLocByKey.get(locKey(upserted.id, areaId));
            const previous = existingLoc?.currentStock ?? 0;
            const delta = s.qty - previous;

            await prisma.inventoryLocation.upsert({
                where: { inventoryItemId_areaId: { inventoryItemId: upserted.id, areaId } },
                update: { currentStock: s.qty, lastCountDate: new Date(data.countDate) },
                create: { inventoryItemId: upserted.id, areaId, currentStock: s.qty, lastCountDate: new Date(data.countDate) },
            });

            if (delta !== 0) {
                await prisma.inventoryMovement.create({
                    data: {
                        inventoryItemId: upserted.id,
                        movementType: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                        quantity: Math.abs(delta),
                        unit: item.baseUnit,
                        areaId,
                        referenceNumber: data.countDate,
                        reason: data.reason,
                        notes: `Stock previo: ${previous} → nuevo: ${s.qty}`,
                        createdById: user.id,
                    },
                });
            }
        }
    }

    // 8. Reporte
    console.log('\n✓ Aplicado.');
    console.log(`  Áreas:        +${stats.areasCreated} nuevas`);
    console.log(`  Ítems:        +${stats.itemsCreated} nuevos, ↻${stats.itemsRevived} revividos, ~${stats.itemsUpdated} actualizados`);
    console.log(`  Stock (loc):  +${stats.locsCreated} nuevas, ~${stats.locsUpdated} ajustadas, =${stats.locsNoChange} sin cambio`);
    console.log(`  Movimientos:  ↑${stats.movementsIn} ADJUSTMENT_IN (+${stats.totalUnitsIn} u), ↓${stats.movementsOut} ADJUSTMENT_OUT (−${stats.totalUnitsOut} u)`);

    const finalCount = await prisma.inventoryItem.count({ where: { tenantId: tenant.id, deletedAt: null } });
    console.log(`  Total ítems activos en ${tenant.slug}: ${finalCount}`);

    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
