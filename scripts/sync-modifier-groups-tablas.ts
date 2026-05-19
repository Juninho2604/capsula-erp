/**
 * sync-modifier-groups-tablas.ts
 * ──────────────────────────────
 * Detecta y corrige inconsistencias en los modifier groups asignados a las
 * Tablas (TABLA-X1, TABLA-X2, TABLA-X4). Originalmente motivado por que
 * TABLA-X4 no tenía el grupo "Cremas" que sí tenían x1 y x2.
 *
 * Algoritmo:
 *   1. Buscar los 3 MenuItems por SKU dentro del tenant target.
 *   2. Listar sus MenuItemModifierGroup (los grupos vinculados a cada uno).
 *   3. Calcular: grupos que están en al menos UNA de las referencias
 *      (x1, x2) pero NO en el target (x4) → "faltantes".
 *   4. Reportar el gap con nombre del grupo y conteo de modifiers que contiene.
 *   5. Si --apply: crear las relaciones faltantes (upsert idempotente).
 *
 * Uso:
 *   # Dry-run (default, no escribe nada):
 *   npx tsx scripts/sync-modifier-groups-tablas.ts --tenant-slug=shanklish
 *
 *   # Aplicar el fix:
 *   npx tsx scripts/sync-modifier-groups-tablas.ts --tenant-slug=shanklish --apply
 *
 *   # Con SKUs distintos:
 *   npx tsx scripts/sync-modifier-groups-tablas.ts \
 *       --tenant-slug=shanklish \
 *       --target=TABLA-X4 \
 *       --references=TABLA-X1,TABLA-X2
 *
 * Seguro: idempotente (upsert respeta @@unique([menuItemId, modifierGroupId])).
 * Reversible: la UI de /dashboard/menu/modificadores permite des-vincular en
 * cualquier momento sin tocar otros datos.
 */

import { PrismaClient } from '@prisma/client';

interface Args {
    tenantSlug: string;
    targetSku: string;
    referenceSkus: string[];
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
    const tenantSlug = map['tenant-slug'];
    if (!tenantSlug) {
        console.error('Falta --tenant-slug. Ejemplo: --tenant-slug=shanklish');
        process.exit(2);
    }
    return {
        tenantSlug,
        targetSku: map['target'] ?? 'TABLA-X4',
        referenceSkus: (map['references'] ?? 'TABLA-X1,TABLA-X2').split(','),
        apply: map['apply'] === 'true',
    };
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('\n=== sync-modifier-groups-tablas ===');
    console.log('Tenant:    ', args.tenantSlug);
    console.log('Target:    ', args.targetSku);
    console.log('References:', args.referenceSkus.join(', '));
    console.log('Modo:      ', args.apply ? 'APPLY' : 'DRY-RUN');

    // 1. Resolver tenant
    const tenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true, slug: true, name: true },
    });
    if (!tenant) {
        console.error(`\n❌ Tenant slug "${args.tenantSlug}" no existe.`);
        process.exit(2);
    }
    console.log(`\nTenant resuelto: ${tenant.name} (${tenant.id})`);

    // 2. Resolver MenuItems por SKU dentro del tenant
    const allSkus = [args.targetSku, ...args.referenceSkus];
    const items = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id, sku: { in: allSkus } },
        include: {
            modifierGroups: {
                include: {
                    modifierGroup: {
                        include: { modifiers: { select: { id: true, name: true } } },
                    },
                },
            },
        },
    });
    const bySku = new Map(items.map((i) => [i.sku, i]));

    // Verificar que estén todos
    const missingItems = allSkus.filter((sku) => !bySku.has(sku));
    if (missingItems.length > 0) {
        console.error(`\n❌ MenuItems no encontrados en tenant: ${missingItems.join(', ')}`);
        process.exit(2);
    }

    const target = bySku.get(args.targetSku)!;
    const references = args.referenceSkus.map((sku) => bySku.get(sku)!);

    // 3. Recolectar grupos en references
    const groupsInReferences = new Map<
        string,
        { id: string; name: string; modifierCount: number; presentIn: string[] }
    >();
    for (const ref of references) {
        for (const link of ref.modifierGroups) {
            const g = link.modifierGroup;
            const existing = groupsInReferences.get(g.id);
            if (existing) {
                existing.presentIn.push(ref.sku);
            } else {
                groupsInReferences.set(g.id, {
                    id: g.id,
                    name: g.name,
                    modifierCount: g.modifiers.length,
                    presentIn: [ref.sku],
                });
            }
        }
    }

    // 4. Grupos en target
    const targetGroupIds = new Set(target.modifierGroups.map((l) => l.modifierGroupId));

    // 5. Calcular gap
    const missing = [...groupsInReferences.values()].filter((g) => !targetGroupIds.has(g.id));

    console.log(`\n── Grupos en ${target.sku} (actual): ${target.modifierGroups.length} ──`);
    for (const link of target.modifierGroups) {
        console.log(
            `   ✓ ${link.modifierGroup.name} (${link.modifierGroup.modifiers.length} mods)`,
        );
    }

    console.log(
        `\n── Grupos en al menos una de [${args.referenceSkus.join(',')}] ──`,
    );
    for (const g of groupsInReferences.values()) {
        const inTarget = targetGroupIds.has(g.id) ? '✓' : '✗';
        console.log(
            `   ${inTarget} ${g.name} (${g.modifierCount} mods) [en: ${g.presentIn.join(',')}]`,
        );
    }

    if (missing.length === 0) {
        console.log(`\n✅ ${target.sku} ya tiene TODOS los grupos de las referencias. Nada que hacer.`);
        await prisma.$disconnect();
        return;
    }

    console.log(`\n🟠 Faltan ${missing.length} grupos en ${target.sku}:`);
    for (const g of missing) {
        console.log(`   → ${g.name} (${g.modifierCount} modifiers)`);
    }

    if (!args.apply) {
        console.log('\n[DRY-RUN] No se modificó nada. Volver a correr con --apply para aplicar.');
        await prisma.$disconnect();
        return;
    }

    // 6. Apply
    console.log('\n[APPLY] Creando relaciones faltantes...');
    let created = 0;
    let skipped = 0;
    for (const g of missing) {
        const result = await prisma.menuItemModifierGroup.upsert({
            where: {
                menuItemId_modifierGroupId: {
                    menuItemId: target.id,
                    modifierGroupId: g.id,
                },
            },
            create: { menuItemId: target.id, modifierGroupId: g.id },
            update: {},
        });
        if (result) {
            created++;
            console.log(`   ✅ Vinculado: ${g.name}`);
        } else {
            skipped++;
        }
    }
    console.log(`\n✅ Listo. Creadas: ${created}, ya existían: ${skipped}.`);
    console.log(`   Verificá en /dashboard/menu/modificadores y probá agregar ${target.sku} a una mesa.`);

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('\n❌ Error:', err);
    process.exit(1);
});
