/**
 * add-platos-principales-to-tablas.ts
 * ───────────────────────────────────
 * Crea (o reutiliza) el grupo de modifiers "Platos Principales (Tabla)"
 * y lo vincula a las 3 Tablas (TABLA-X1, TABLA-X2, TABLA-X4) para que
 * la cajera pueda elegir cuáles 3 principales incluye cada tabla cuando
 * la arma en el POS. La descripción de cada Tabla dice "3 principales"
 * y hoy no hay forma de capturarlos — la cocina los adivina.
 *
 * Algoritmo:
 *   1. Resolver tenant por slug.
 *   2. Upsert MenuModifierGroup "Platos Principales (Tabla)"
 *      (min=3, max=3, isRequired=true) en el tenant.
 *   3. Upsert los MenuModifier (uno por plato principal disponible)
 *      vinculados a ese grupo, con priceAdjustment=0 (los principales
 *      no suman precio: el costo ya está dentro del precio de la Tabla).
 *   4. Vincular el grupo a TABLA-X1, TABLA-X2, TABLA-X4 vía
 *      MenuItemOnModifierGroup (upsert idempotente).
 *
 * Uso:
 *   # Dry-run (default, no escribe nada):
 *   npx tsx scripts/add-platos-principales-to-tablas.ts --tenant-slug=shanklish
 *
 *   # Aplicar:
 *   npx tsx scripts/add-platos-principales-to-tablas.ts --tenant-slug=shanklish --apply
 *
 * Es idempotente: re-correrlo no duplica grupos ni modifiers.
 * Para editar la lista de principales después, abrir
 * /dashboard/menu/modificadores y modificar el grupo.
 */

import { PrismaClient } from '@prisma/client';

const TABLA_SKUS = ['TABLA-X1', 'TABLA-X2', 'TABLA-X4'];

// Lista por defecto de platos principales que pueden incluirse en una
// Tabla. Coincide con la categoría "Platos Principales" del menú real
// (seed-menu-real.ts) pero usando la porción chica/representativa de
// cada uno — el costo va contra la Tabla, no contra el modifier.
const DEFAULT_PRINCIPALES = [
    { id: 'mod-tabla-prin-falafel', name: 'Falafel' },
    { id: 'mod-tabla-prin-kibbe-crudo', name: 'Kibbe Crudo' },
    { id: 'mod-tabla-prin-kibbe-horneado', name: 'Kibbe Horneado' },
    { id: 'mod-tabla-prin-kibbe-frito', name: 'Kibbe Frito' },
    { id: 'mod-tabla-prin-mini-kibbe', name: 'Mini Kibbe Frito' },
    { id: 'mod-tabla-prin-pincho-pollo', name: 'Pincho de Pollo' },
    { id: 'mod-tabla-prin-pincho-carne', name: 'Pincho de Carne' },
    { id: 'mod-tabla-prin-pincho-kafta', name: 'Pincho de Kafta' },
    { id: 'mod-tabla-prin-pincho-mixto', name: 'Pincho Mixto' },
    { id: 'mod-tabla-prin-arroz-pollo', name: 'Arroz con Pollo Libanés' },
];

const GROUP_ID = 'mod-group-tabla-principales';

interface Args {
    tenantSlug: string;
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
    return { tenantSlug, apply: map['apply'] === 'true' };
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('\n=== add-platos-principales-to-tablas ===');
    console.log('Tenant:', args.tenantSlug);
    console.log('Modo:  ', args.apply ? 'APPLY' : 'DRY-RUN');

    const tenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true, slug: true, name: true },
    });
    if (!tenant) {
        console.error(`\nTenant slug "${args.tenantSlug}" no existe.`);
        process.exit(2);
    }
    console.log(`\nTenant resuelto: ${tenant.name} (${tenant.id})`);

    // Verificar que las tablas existen
    const tablas = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id, sku: { in: TABLA_SKUS } },
        select: { id: true, sku: true, name: true },
    });
    const tablaBySku = new Map(tablas.map((t) => [t.sku, t]));
    const missingTablas = TABLA_SKUS.filter((sku) => !tablaBySku.has(sku));
    if (missingTablas.length > 0) {
        console.error(`\nFaltan Tablas en el tenant: ${missingTablas.join(', ')}`);
        console.error('Correr primero `prisma db seed` o el seed de menú correspondiente.');
        process.exit(2);
    }
    console.log(`\nTablas encontradas: ${tablas.map((t) => t.sku).join(', ')}`);

    // Chequear estado actual del grupo
    const existingGroup = await prisma.menuModifierGroup.findFirst({
        where: { tenantId: tenant.id, id: GROUP_ID },
        include: { modifiers: { select: { id: true, name: true } } },
    });
    if (existingGroup) {
        console.log(`\nGrupo ya existe: "${existingGroup.name}" con ${existingGroup.modifiers.length} modifiers.`);
    } else {
        console.log('\nGrupo NO existe — se creará nuevo.');
    }

    console.log('\n── Modifiers que se asegurarán (upsert) ──');
    for (const m of DEFAULT_PRINCIPALES) {
        console.log(`   ${m.name}`);
    }

    console.log('\n── Tablas a vincular ──');
    for (const t of tablas) {
        console.log(`   ${t.sku} — ${t.name}`);
    }

    if (!args.apply) {
        console.log('\n[DRY-RUN] No se escribió nada. Re-correr con --apply para aplicar.');
        await prisma.$disconnect();
        return;
    }

    // 1. Upsert grupo
    const group = await prisma.menuModifierGroup.upsert({
        where: { id: GROUP_ID },
        create: {
            id: GROUP_ID,
            tenantId: tenant.id,
            name: 'Platos Principales (Tabla)',
            isRequired: true,
            minSelections: 3,
            maxSelections: 3,
        },
        update: {
            tenantId: tenant.id,
            name: 'Platos Principales (Tabla)',
            isRequired: true,
            minSelections: 3,
            maxSelections: 3,
        },
    });
    console.log(`\nGrupo upserted: ${group.id}`);

    // 2. Upsert modifiers
    let modsCreated = 0;
    let modsUpdated = 0;
    for (const m of DEFAULT_PRINCIPALES) {
        const existing = await prisma.menuModifier.findUnique({ where: { id: m.id } });
        await prisma.menuModifier.upsert({
            where: { id: m.id },
            create: {
                id: m.id,
                tenantId: tenant.id,
                name: m.name,
                priceAdjustment: 0,
                groupId: group.id,
            },
            update: {
                tenantId: tenant.id,
                name: m.name,
                priceAdjustment: 0,
                groupId: group.id,
            },
        });
        if (existing) modsUpdated++; else modsCreated++;
    }
    console.log(`Modifiers — creados: ${modsCreated}, actualizados: ${modsUpdated}`);

    // 3. Vincular grupo a cada tabla
    let linksCreated = 0;
    for (const t of tablas) {
        await prisma.menuItemModifierGroup.upsert({
            where: {
                menuItemId_modifierGroupId: {
                    menuItemId: t.id,
                    modifierGroupId: group.id,
                },
            },
            create: { menuItemId: t.id, modifierGroupId: group.id },
            update: {},
        });
        linksCreated++;
        console.log(`   Vinculado: ${t.sku} → ${group.name}`);
    }

    console.log(`\nListo. Links: ${linksCreated}. Verificá en /dashboard/menu/modificadores`);
    console.log(`y probá agregar una Tabla en el POS — debería pedir 3 principales.`);

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('\nError:', err);
    process.exit(1);
});
