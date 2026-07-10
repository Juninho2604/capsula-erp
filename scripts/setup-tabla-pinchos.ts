/**
 * setup-tabla-pinchos.ts (§90)
 * ────────────────────────────
 * Crea/actualiza un grupo de modificadores "Pinchos (Tabla xN)" POR CADA
 * tabla, con selección de cantidad EXACTA de varas según el tamaño:
 *
 *   Tabla x1 → 1 vara   (min=1, max=1)
 *   Tabla x2 → 2 varas  (min=2, max=2)
 *   Tabla x4 → 4 varas  (min=4, max=4)
 *
 * Opciones (varas) en cada grupo: Pincho de Pollo, Pincho de Carne, Pincho
 * de Kafta, Pincho Mixto — con stepper para repetir sabores (ej. en la x4:
 * 2 pollo + 1 carne + 1 kafta). El mesero DEBE completar la cantidad exacta
 * antes de marchar (min = max).
 *
 * Por qué un grupo por tabla (y no anidado bajo un "Pincho Mixto"
 * compartido): las 3 tablas comparten el grupo "Platos Principales (Tabla)",
 * así que un solo modificador no puede desplegar 1 vara en la x1 y 4 en la
 * x4. Un grupo dedicado por tabla resuelve la cantidad exacta sin tocar la
 * config de principales.
 *
 * NO toca el grupo "Platos Principales (Tabla)". Es idempotente (IDs
 * deterministas) y reversible (podés desvincular/eliminar desde
 * /dashboard/menu/modificadores).
 *
 * LIMPIEZA (fase 2): si las tablas quedaron vinculadas a otro grupo de
 * pinchos (ej. el "PINCHOS" mín. 3 de la ración, vinculado a mano), el
 * script LO DESVINCULA de las tablas (el grupo queda intacto para la
 * ración). Y si algún modificador de los grupos de las tablas despliega un
 * sub-grupo de pinchos (childGroup §82), lo desactiva ahí — el grupo
 * dedicado por tabla lo reemplaza. Sin esta limpieza, la tabla seguiría
 * exigiendo el mínimo del grupo compartido (ej. 3 varas en la x1).
 *
 * Los modificadores se crean SIN descargo de inventario. El descargo por
 * vara (gramos de pollo/carne/kafta) se configura después en el admin
 * (receta propia §80 o vínculo a plato), para no descargar cantidades
 * equivocadas automáticamente.
 *
 * Uso:
 *   # Dry-run (default, no escribe nada):
 *   npx tsx scripts/setup-tabla-pinchos.ts --tenant-slug=shanklish
 *   # Aplicar:
 *   npx tsx scripts/setup-tabla-pinchos.ts --tenant-slug=shanklish --apply
 */

import { PrismaClient } from '@prisma/client';

const TABLAS: Array<{ sku: string; label: string; varas: number }> = [
    { sku: 'TABLA-X1', label: 'Tabla x1', varas: 1 },
    { sku: 'TABLA-X2', label: 'Tabla x2', varas: 2 },
    { sku: 'TABLA-X4', label: 'Tabla x4', varas: 4 },
];

// Varas seleccionables (mismas 4 para las 3 tablas). ID determinista por
// tabla+sabor → idempotente.
const SABORES: Array<{ key: string; name: string }> = [
    { key: 'pollo', name: 'Pincho de Pollo' },
    { key: 'carne', name: 'Pincho de Carne' },
    { key: 'kafta', name: 'Pincho de Kafta' },
    { key: 'mixto', name: 'Pincho Mixto' },
];

interface Args { tenantSlug: string; apply: boolean; }

function parseArgs(): Args {
    const map: Record<string, string> = {};
    for (const arg of process.argv.slice(2)) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    const tenantSlug = map['tenant-slug'];
    if (!tenantSlug) {
        console.error('Falta --tenant-slug. Ej: --tenant-slug=shanklish');
        process.exit(2);
    }
    return { tenantSlug, apply: map['apply'] === 'true' };
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('\n=== setup-tabla-pinchos (§90) ===');
    console.log('Tenant:', args.tenantSlug, '| Modo:', args.apply ? 'APPLY' : 'DRY-RUN');

    const tenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true, name: true },
    });
    if (!tenant) { console.error(`Tenant "${args.tenantSlug}" no existe.`); process.exit(2); }
    console.log(`Tenant: ${tenant.name} (${tenant.id})`);

    const tablas = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id, sku: { in: TABLAS.map(t => t.sku) } },
        select: { id: true, sku: true, name: true },
    });
    const bySku = new Map(tablas.map(t => [t.sku, t]));
    const missing = TABLAS.filter(t => !bySku.has(t.sku));
    if (missing.length > 0) {
        console.error(`\nFaltan tablas: ${missing.map(t => t.sku).join(', ')}. Verificá los SKUs del menú.`);
        process.exit(2);
    }

    for (const t of TABLAS) {
        const item = bySku.get(t.sku)!;
        const groupId = `mod-group-pinchos-${t.sku.toLowerCase()}`;
        const groupName = `Pinchos (${t.label})`;

        console.log(`\n── ${t.label} (${item.name}) — grupo "${groupName}" min=max=${t.varas}`);
        for (const s of SABORES) console.log(`     + ${s.name}`);

        if (!args.apply) continue;

        await prisma.menuModifierGroup.upsert({
            where: { id: groupId },
            create: {
                id: groupId, tenantId: tenant.id, name: groupName,
                isRequired: true, minSelections: t.varas, maxSelections: t.varas, sortOrder: 50,
            },
            update: {
                tenantId: tenant.id, name: groupName,
                isRequired: true, minSelections: t.varas, maxSelections: t.varas,
            },
        });

        for (let i = 0; i < SABORES.length; i++) {
            const s = SABORES[i];
            const modId = `mod-pincho-${t.sku.toLowerCase()}-${s.key}`;
            await prisma.menuModifier.upsert({
                where: { id: modId },
                create: { id: modId, tenantId: tenant.id, name: s.name, priceAdjustment: 0, groupId, sortOrder: i },
                update: { tenantId: tenant.id, name: s.name, priceAdjustment: 0, groupId, sortOrder: i },
            });
        }

        await prisma.menuItemModifierGroup.upsert({
            where: { menuItemId_modifierGroupId: { menuItemId: item.id, modifierGroupId: groupId } },
            create: { menuItemId: item.id, modifierGroupId: groupId },
            update: {},
        });
        console.log(`     ✓ grupo + ${SABORES.length} varas + vínculo a ${t.sku}`);
    }

    // ── FASE 2: limpieza de grupos de pinchos legacy en las tablas ──────
    // Sin esto, la tabla seguiría exigiendo el mínimo del grupo compartido
    // (ej. "PINCHOS" mín. 3 de la ración) además del grupo dedicado.
    console.log('\n── Limpieza: grupos/sub-grupos de pinchos legacy en las tablas');
    const PINCHO_RE = /pincho/i;
    const dedicatedIds = new Set(TABLAS.map(t => `mod-group-pinchos-${t.sku.toLowerCase()}`));
    const tablaItemIds = new Set(tablas.map(t => t.id));

    const links = await prisma.menuItemModifierGroup.findMany({
        where: { menuItemId: { in: [...tablaItemIds] } },
        include: {
            menuItem: { select: { sku: true } },
            modifierGroup: {
                include: {
                    modifiers: { include: { childGroup: { select: { id: true, name: true, minSelections: true } } } },
                    menuItems: { select: { menuItemId: true } },
                },
            },
        },
    });

    let cleanupCount = 0;
    for (const link of links) {
        const g = link.modifierGroup;
        if (dedicatedIds.has(g.id)) continue;

        // Caso A: grupo de pinchos vinculado directo a la tabla (ej. el
        // "PINCHOS" mín. 3 de la ración) → desvincular SOLO de la tabla.
        // El grupo no se toca: la ración lo sigue usando.
        if (PINCHO_RE.test(g.name)) {
            cleanupCount++;
            console.log(`   ✂ ${link.menuItem.sku}: desvincular grupo "${g.name}" (min ${g.minSelections}) — lo reemplaza el dedicado`);
            if (args.apply) {
                await prisma.menuItemModifierGroup.delete({ where: { id: link.id } });
            }
            continue;
        }

        // Caso B: dentro de un grupo de la tabla (ej. principales), un
        // modificador despliega un sub-grupo de pinchos (§82). Quitarle el
        // despliegue solo es seguro si el grupo es EXCLUSIVO de las tablas
        // (si lo comparte la ración u otro item, se avisa y se deja).
        const sharedOutsideTablas = g.menuItems.some(mi => !tablaItemIds.has(mi.menuItemId));
        for (const mod of g.modifiers) {
            if (!mod.childGroup || !PINCHO_RE.test(mod.childGroup.name)) continue;
            if (sharedOutsideTablas) {
                console.log(`   ⚠ "${g.name}" → "${mod.name}" despliega "${mod.childGroup.name}" (min ${mod.childGroup.minSelections}), pero el grupo lo comparten otros items — revisar a mano en /dashboard/menu/modificadores`);
                continue;
            }
            cleanupCount++;
            console.log(`   ✂ "${g.name}" → "${mod.name}": quitar despliegue de "${mod.childGroup.name}" — lo reemplaza el grupo dedicado`);
            if (args.apply) {
                await prisma.menuModifier.update({ where: { id: mod.id }, data: { childGroupId: null } });
            }
        }
    }
    if (cleanupCount === 0) console.log('   (nada que limpiar)');

    if (!args.apply) {
        console.log('\n[DRY-RUN] No se escribió nada. Re-correr con --apply para aplicar.');
    } else {
        console.log('\nListo. Probá agregar cada tabla en el POS — debe pedir la cantidad exacta de varas.');
        console.log('Configurá el descargo por vara en /dashboard/menu/modificadores (receta propia).');
    }
    await prisma.$disconnect();
}

main().catch(async (err) => { console.error('\nError:', err); process.exit(1); });
